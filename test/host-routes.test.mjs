import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { apply } from '../index.js';

function bootHost(notesFile, config = {}) {
  let handler = null;
  const ctx = {
    logger: { warn() {}, info() {}, error() {}, debug() {} },
    effect(callback) {
      const cleanup = callback();
      return typeof cleanup === 'function' ? cleanup : undefined;
    },
    inject(_names, callback) {
      callback({
        webServer: { register(route) { handler = route.handler; return () => {}; } },
        effect(callback2) {
          const cleanup = callback2();
          return typeof cleanup === 'function' ? cleanup : undefined;
        },
      });
    },
  };
  apply(ctx, { notesFile, ...config });
  assert.equal(typeof handler, 'function');
  return { handler };
}

function call(handler, { method = 'GET', url = '/api/note-wall/state', body, peer = '127.0.0.1' } = {}) {
  return new Promise((resolve) => {
    const listeners = new Map();
    const headers = { host: '127.0.0.1:10632', 'sec-fetch-site': 'same-origin' };
    const request = {
      method,
      url,
      headers,
      socket: { remoteAddress: peer },
      on(type, listener) {
        listeners.set(type, listener);
        return request;
      },
    };
    const response = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) { response.headers[String(name).toLowerCase()] = value; },
      end(payload) {
        let parsed = null;
        try { parsed = payload ? JSON.parse(payload) : null; } catch { parsed = payload; }
        resolve({ status: response.statusCode, headers: response.headers, body: parsed });
      },
    };
    handler(request, response);
    if (body !== undefined) {
      setImmediate(() => {
        listeners.get('data')?.(Buffer.from(body));
        listeners.get('end')?.();
      });
    }
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTempFile(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'note-wall-host-'));
  try {
    await run({ dir, file: path.join(dir, 'notes.json') });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('mutations are refused until the notes file has loaded', async () => {
  await withTempFile(async ({ file }) => {
    const { handler } = bootHost(file);
    const early = await call(handler, {
      method: 'POST',
      url: '/api/note-wall/notes',
      body: JSON.stringify({ text: 'too early' }),
    });
    assert.equal(early.status, 503);
    assert.equal(early.body.error, 'loading');

    await delay(80);
    const state = await call(handler);
    assert.equal(state.status, 200);
    assert.deepEqual(state.body.notes, []);
    assert.equal(state.body.file, 'notes.json', 'only the basename is returned');
    assert.equal(state.headers['x-content-type-options'], 'nosniff');
  });
});

test('a valid write after loading persists the full snapshot and hides the absolute path', async () => {
  await withTempFile(async ({ dir, file }) => {
    const { handler } = bootHost(file);
    await delay(80);
    const created = await call(handler, {
      method: 'POST',
      url: '/api/note-wall/notes',
      body: JSON.stringify({ text: '第一个灵感', color: 'lime' }),
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.notes.length, 1);
    assert.equal(created.body.file, 'notes.json');
    assert.equal(JSON.stringify(created.body).includes(dir), false, 'the absolute notes path never leaves the host');

    const stored = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(stored.notes[0].text, '第一个灵感');
  });
});

test('a failed startup load turns writes into storage-unavailable but keeps state readable', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'note-wall-host-'));
  try {
    const { handler } = bootHost(dir);
    await delay(120);
    const write = await call(handler, {
      method: 'POST',
      url: '/api/note-wall/notes',
      body: JSON.stringify({ text: 'blocked' }),
    });
    assert.equal(write.status, 503);
    assert.equal(write.body.error, 'storage-unavailable');
    const state = await call(handler);
    assert.equal(state.status, 200);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the route fence rejects a LAN peer even with a loopback Host header', async () => {
  await withTempFile(async ({ file }) => {
    const { handler } = bootHost(file);
    const response = await call(handler, { peer: '192.168.1.9' });
    assert.equal(response.status, 403);
    assert.equal(response.body.reason, 'non-loopback-peer');
  });
});

test('the wish route rejects an empty prompt without calling the model', async () => {
  await withTempFile(async ({ file }) => {
    const { handler } = bootHost(file);
    const response = await call(handler, {
      method: 'POST',
      url: '/api/note-wall/wish/optimize',
      body: JSON.stringify({ text: '   ' }),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'empty-prompt');
  });
});

test('the wish route allows one in-flight optimization and accepts long prompts', async () => {
  await withTempFile(async ({ file }) => {
    const optimizerFile = path.join(path.dirname(file), 'prompt-optimizer-data.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(optimizerFile, JSON.stringify({
      models: JSON.stringify({
        deepseek: {
          enabled: true,
          providerId: 'deepseek',
          modelId: 'deepseek-v4-flash',
          connectionConfig: { baseURL: 'https://api.deepseek.com', apiKey: 'test-key' },
        },
      }),
    }), 'utf8');

    const { handler } = bootHost(file, { promptOptimizerData: optimizerFile });
    await delay(80);

    const originalFetch = globalThis.fetch;
    let release = null;
    globalThis.fetch = () => new Promise((resolve) => {
      release = () => resolve({ ok: true, async json() { return { choices: [{ message: { content: '优化结果' } }] }; } });
    });
    try {
      const longPrompt = `${'灵'.repeat(7000)}`;
      const first = call(handler, {
        method: 'POST',
        url: '/api/note-wall/wish/optimize',
        body: JSON.stringify({ text: longPrompt }),
      });
      await delay(40);
      assert.equal(typeof release, 'function', 'the optimizer request is in flight');
      const second = await call(handler, {
        method: 'POST',
        url: '/api/note-wall/wish/optimize',
        body: JSON.stringify({ text: 'second' }),
      });
      assert.equal(second.status, 429);
      assert.equal(second.body.error, 'optimizer-busy');
      release();
      const done = await first;
      assert.equal(done.status, 200);
      assert.equal(done.body.prompt, '优化结果');
      assert.equal(done.body.provider, 'deepseek');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
