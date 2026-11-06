import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { defaultDataFile, loadNotes, sanitizeNotes, saveNotes } from '../src/store.mjs';

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'note-wall-'));
}

test('defaultDataFile prefers DSH_HOME', () => {
  const configured = defaultDataFile({ DSH_HOME: 'D:/dsh-home' }).replace(/\\/g, '/');
  assert.equal(configured, 'D:/dsh-home/note-wall/notes.json');
  const fallback = defaultDataFile({}).replace(/\\/g, '/');
  assert.match(fallback, /\/\.dsh\/note-wall\/notes\.json$/);
});

test('sanitizeNotes drops invalid rows and normalizes fields', () => {
  const notes = sanitizeNotes([
    null,
    'not-a-note',
    { text: '   ' },
    { id: 'n1', text: '  hello\r\nworld  ', color: 'sky', pinned: true, createdAt: '2026-01-02T03:04:05.000Z', updatedAt: '2026-01-02T03:04:06.000Z' },
    { id: 'n1', text: 'duplicate id', color: 'nope' },
  ]);

  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0], {
    id: 'n1',
    text: 'hello\nworld',
    color: 'sky',
    pinned: true,
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:06.000Z',
  });
  assert.notEqual(notes[1].id, 'n1');
  assert.equal(notes[1].color, 'amber');
  assert.equal(notes[1].pinned, false);
});

test('save then load round-trips notes atomically', async () => {
  const dir = await tempDir();
  const file = join(dir, 'nested', 'notes.json');
  const notes = [{
    id: 'a',
    text: 'one two',
    color: 'mint',
    pinned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }];

  await saveNotes(file, notes);
  const payload = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(payload.version, 1);

  const loaded = await loadNotes(file);
  assert.deepEqual(loaded, { notes, corrupt: false });

  const leftovers = (await readdir(join(dir, 'nested'))).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('missing file starts empty', async () => {
  const dir = await tempDir();
  const loaded = await loadNotes(join(dir, 'notes.json'));
  assert.deepEqual(loaded, { notes: [], corrupt: false });
});

test('corrupt file is quarantined instead of parsed', async () => {
  const dir = await tempDir();
  const file = join(dir, 'notes.json');
  await writeFile(file, '{not json', 'utf8');

  const loaded = await loadNotes(file);
  assert.deepEqual(loaded, { notes: [], corrupt: true });

  const names = await readdir(dir);
  assert.ok(names.some((name) => name.startsWith('notes.json.corrupt-')));
  assert.ok(!names.includes('notes.json'));
});
