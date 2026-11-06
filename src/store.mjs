/**
 * Durable note store for the note-wall host half.
 *
 * One JSON document lives under `$DSH_HOME/note-wall/notes.json`. Writes are
 * atomic (temp file + rename) and corrupt documents are moved aside instead of
 * being overwritten, mirroring the storage conventions of shipped DSH plugins.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const MAX_TEXT = 5000;
export const COLORS = Object.freeze(['amber', 'rose', 'sky', 'mint', 'violet', 'cream', 'lime']);

const COLOR_SET = new Set(COLORS);
const VERSION = 1;

export function defaultDataFile(env = process.env) {
  const home = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim() !== ''
    ? env.DSH_HOME.trim()
    : join(homedir(), '.dsh');
  return join(home, 'note-wall', 'notes.json');
}

/** Trim, normalize line endings and cap one note at MAX_TEXT characters. */
export function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT);
}

export function normalizeColor(value) {
  return COLOR_SET.has(value) ? value : 'amber';
}

function isoOr(value, fallback) {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return fallback;
}

/** Decode one persisted note list defensively; invalid rows are dropped. */
export function sanitizeNotes(raw) {
  const notes = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (item === null || typeof item !== 'object') continue;
    const text = normalizeText(item.text);
    if (text === '') continue;
    const rawId = typeof item.id === 'string' ? item.id.trim() : '';
    const id = rawId !== '' && !seen.has(rawId) ? rawId : randomUUID();
    seen.add(id);
    const createdAt = isoOr(item.createdAt, new Date().toISOString());
    notes.push({
      id,
      text,
      color: normalizeColor(item.color),
      pinned: item.pinned === true,
      createdAt,
      updatedAt: isoOr(item.updatedAt, createdAt),
    });
  }
  return notes;
}

async function quarantine(file) {
  try {
    await rename(file, `${file}.corrupt-${Date.now()}`);
  } catch {
    // A failed quarantine must not block startup with an empty wall.
  }
}

export async function loadNotes(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { notes: [], corrupt: false };
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    await quarantine(file);
    return { notes: [], corrupt: true };
  }
  const raw = Array.isArray(parsed) ? parsed : parsed?.notes;
  return { notes: sanitizeNotes(raw), corrupt: false };
}

export async function saveNotes(file, notes) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  const payload = `${JSON.stringify({ version: VERSION, notes }, null, 2)}\n`;
  await writeFile(temp, payload, { encoding: 'utf8', mode: 0o600 });
  await rename(temp, file);
}
