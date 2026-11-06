/**
 * dsh-note-wall — host half.
 *
 * All durable note state lives here (JSON under $DSH_HOME/note-wall). The
 * browser half only renders and calls these same-origin routes:
 *
 *   GET    /api/note-wall/state          -> { ok, notes }
 *   POST   /api/note-wall/notes          -> create, returns the full wall
 *   PATCH  /api/note-wall/notes/:id      -> edit text/color/pinned
 *   DELETE /api/note-wall/notes/:id      -> delete
 *   POST   /api/note-wall/wish/optimize  -> optimize a prompt through PromptOptimizer's model
 *
 * Every mutation returns the complete note list so the client never has to
 * merge partial views.
 */

import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';

import { defaultDataFile, loadNotes, normalizeColor, normalizeText, saveNotes } from './src/store.mjs';
import { structuralRejection } from './src/trust.mjs';
import { defaultOptimizerDataFile, optimizePrompt } from './src/wish-optimizer.mjs';

export const name = 'dsh-note-wall';
export const inject = [];

const API_PATH = '/api/note-wall';
const BODY_LIMIT = 256 * 1024;
const MAX_WISH_PROMPT = 16000;
const WISH_WINDOW_MS = 60_000;
const WISH_MAX_PER_WINDOW = 8;

class RouteError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function apply(ctx, config) {
  const configured = typeof config?.notesFile === 'string' && config.notesFile.trim() !== ''
    ? config.notesFile.trim()
    : undefined;
  const notesFile = configured ?? defaultDataFile();
  const configuredOptimizer = typeof config?.promptOptimizerData === 'string' && config.promptOptimizerData.trim() !== ''
    ? config.promptOptimizerData.trim()
    : undefined;
  // Resolved lazily: a machine without PromptOptimizer data must still load the
  // note wall instead of failing `apply` at startup.
  const resolveOptimizerDataFile = () => configuredOptimizer ?? defaultOptimizerDataFile();
  const state = { notes: [], loaded: false, loadError: null, chain: Promise.resolve() };
  let optimizerInFlight = false;
  const optimizerCalls = [];

  const log = (level, message) => {
    try {
      const logger = ctx.logger;
      const write = logger?.[level];
      if (typeof write === 'function') write.call(logger, `dsh-note-wall: ${message}`);
    } catch {
      // logging must never break the plugin
    }
  };
  const warn = (message) => log('warn', message);

  const snapshot = () => ({ ok: true, notes: state.notes, file: basename(notesFile) });

  /** Mutations must not race the startup load: an early write would overwrite it. */
  function assertStorageReady() {
    if (!state.loaded) throw new RouteError(503, 'loading');
    if (state.loadError !== null) throw new RouteError(503, 'storage-unavailable');
  }

  /** One optimization at a time, with a small per-minute budget. */
  function admitOptimizerCall() {
    const now = Date.now();
    while (optimizerCalls.length > 0 && now - optimizerCalls[0] > WISH_WINDOW_MS) optimizerCalls.shift();
    if (optimizerInFlight) throw new RouteError(429, 'optimizer-busy');
    if (optimizerCalls.length >= WISH_MAX_PER_WINDOW) throw new RouteError(429, 'optimizer-rate-limited');
    optimizerInFlight = true;
    optimizerCalls.push(now);
  }

  /** Serialize mutations so two requests can never interleave a read-modify-write. */
  function queue(task) {
    const run = state.chain.then(task, task);
    state.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function commit(next) {
    await saveNotes(notesFile, next);
    state.notes = next;
    return snapshot();
  }

  const findNote = (id) => state.notes.find((note) => note.id === id) ?? null;

  async function createNote(body) {
    const text = normalizeText(body?.text);
    if (text === '') throw new RouteError(400, 'empty-note');
    const now = new Date().toISOString();
    const note = {
      id: randomUUID(),
      text,
      color: normalizeColor(body?.color),
      pinned: body?.pinned === true,
      createdAt: now,
      updatedAt: now,
    };
    return commit([note, ...state.notes]);
  }

  async function updateNote(id, body) {
    const current = findNote(id);
    if (current === null) throw new RouteError(404, 'note-not-found');
    const patch = {};
    if (body?.text !== undefined) {
      const text = normalizeText(body.text);
      if (text === '') throw new RouteError(400, 'empty-note');
      patch.text = text;
    }
    if (body?.color !== undefined) patch.color = normalizeColor(body.color);
    if (body?.pinned !== undefined) patch.pinned = body.pinned === true;
    if (Object.keys(patch).length === 0) return snapshot();
    const next = state.notes.map((note) => (
      note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
    ));
    return commit(next);
  }

  async function deleteNote(id) {
    if (findNote(id) === null) throw new RouteError(404, 'note-not-found');
    return commit(state.notes.filter((note) => note.id !== id));
  }

  function send(response, status, payload) {
    try {
      response.statusCode = status;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      response.setHeader('x-content-type-options', 'nosniff');
      response.end(JSON.stringify(payload));
    } catch {
      // connection may already be gone
    }
  }

  function readJson(request) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      request.on('data', (chunk) => {
        size += chunk.length;
        if (size > BODY_LIMIT) {
          reject(new RouteError(413, 'body-too-large'));
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch {
          reject(new RouteError(400, 'invalid-body'));
        }
      });
      request.on('error', reject);
    });
  }

  async function handler(request, response) {
    const rejection = structuralRejection(request);
    if (rejection !== undefined) {
      send(response, 403, { ok: false, error: 'forbidden', reason: rejection });
      return;
    }

    let url;
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1');
    } catch {
      send(response, 400, { ok: false, error: 'bad-request' });
      return;
    }
    const pathname = url.pathname;
    const route = pathname === API_PATH
      ? '/'
      : pathname.startsWith(`${API_PATH}/`)
        ? pathname.slice(API_PATH.length)
        : pathname;
    const method = request.method ?? 'GET';

    try {
      if (method === 'GET' && route === '/state') {
        send(response, 200, snapshot());
        return;
      }

      if (method === 'POST' && route === '/wish/optimize') {
        const body = await readJson(request);
        // The note store caps notes at 5000 chars, but this route also carries
        // the surrounding template instructions; keep a larger, explicit budget
        // instead of reusing the note normalizer.
        const text = typeof body?.text === 'string'
          ? body.text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_WISH_PROMPT)
          : '';
        if (text === '') {
          send(response, 400, { ok: false, error: 'empty-prompt' });
          return;
        }
        admitOptimizerCall();
        try {
          let dataFile;
          try {
            dataFile = resolveOptimizerDataFile();
          } catch {
            throw Object.assign(new Error('prompt optimizer data file is unavailable'), { code: 'optimizer-config-missing' });
          }
          const optimized = await optimizePrompt({ prompt: text, dataFile });
          send(response, 200, {
            ok: true,
            prompt: optimized.prompt,
            model: optimized.model,
            provider: optimized.providerId,
          });
        } catch (error) {
          if (error instanceof RouteError) {
            send(response, error.status, { ok: false, error: error.code });
            return;
          }
          const code = typeof error?.code === 'string' ? error.code : 'optimizer-request-failed';
          warn(`prompt optimization failed (${code}): ${String(error?.message ?? error)}`);
          send(response, 502, { ok: false, error: code });
        } finally {
          optimizerInFlight = false;
        }
        return;
      }

      if (method === 'POST' && route === '/notes') {
        assertStorageReady();
        const body = await readJson(request);
        send(response, 200, await queue(() => createNote(body)));
        return;
      }

      const match = /^\/notes\/([^/]+)$/.exec(route);
      if (match !== null) {
        const id = decodeURIComponent(match[1]);
        if (method === 'PATCH' || method === 'POST') {
          assertStorageReady();
          const body = await readJson(request);
          send(response, 200, await queue(() => updateNote(id, body)));
          return;
        }
        if (method === 'DELETE') {
          assertStorageReady();
          send(response, 200, await queue(() => deleteNote(id)));
          return;
        }
      }

      send(response, 404, { ok: false, error: 'not-found' });
    } catch (error) {
      if (error instanceof RouteError) {
        send(response, error.status, { ok: false, error: error.code });
        return;
      }
      warn(`request failed: ${String(error?.message ?? error)}`);
      send(response, 500, { ok: false, error: 'internal-error' });
    }
  }

  ctx.inject(['webServer'], (scoped) => {
    const server = scoped.webServer;
    scoped.effect(
      () => server.register({ kind: 'prefix', path: API_PATH, handler }),
      'dsh-note-wall: api routes',
    );
  });

  void (async () => {
    try {
      const loaded = await loadNotes(notesFile);
      if (loaded.corrupt) warn('notes file was unreadable; moved aside and starting from an empty wall');
      state.notes = loaded.notes;
    } catch (error) {
      state.loadError = String(error?.message ?? error);
      warn(`could not load notes: ${state.loadError}`);
    } finally {
      state.loaded = true;
    }
  })();
}
