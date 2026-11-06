import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  MAX_OPTIMIZED_CHARS,
  MAX_PROMPT_CHARS,
  assertSecureEndpoint,
  buildOptimizerMessages,
  optimizePrompt,
} from '../src/wish-optimizer.mjs';

async function withDataFile(baseURL, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'note-wall-optimizer-security-'));
  const file = path.join(dir, 'prompt-optimizer-data.json');
  await writeFile(file, JSON.stringify({
    models: JSON.stringify({
      deepseek: {
        enabled: true,
        providerId: 'deepseek',
        modelId: 'deepseek-v4-flash',
        connectionConfig: { baseURL, apiKey: 'test-key' },
      },
    }),
  }), 'utf8');
  try {
    await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function errorCode(fn) {
  try {
    fn();
  } catch (error) {
    return error?.code;
  }
  return undefined;
}

test('assertSecureEndpoint accepts HTTPS and normalizes trailing slashes', () => {
  assert.equal(assertSecureEndpoint('https://api.deepseek.com/'), 'https://api.deepseek.com');
  assert.equal(assertSecureEndpoint('http://127.0.0.1:11434'), 'http://127.0.0.1:11434');
  assert.equal(assertSecureEndpoint('http://localhost:8080/'), 'http://localhost:8080');
  assert.equal(assertSecureEndpoint('http://[::1]:11434'), 'http://[::1]:11434');
});

test('assertSecureEndpoint refuses remote plain HTTP and malformed URLs', () => {
  assert.equal(errorCode(() => assertSecureEndpoint('http://api.deepseek.com')), 'optimizer-insecure-endpoint');
  assert.equal(errorCode(() => assertSecureEndpoint('http://192.168.1.10:8000')), 'optimizer-insecure-endpoint');
  assert.equal(errorCode(() => assertSecureEndpoint('file:///etc/passwd')), 'optimizer-insecure-endpoint');
  assert.equal(errorCode(() => assertSecureEndpoint('not a url')), 'optimizer-insecure-endpoint');
});

test('buildOptimizerMessages truncates over-long prompts before they reach the model', () => {
  const messages = buildOptimizerMessages('灵'.repeat(MAX_PROMPT_CHARS + 5000));
  assert.equal(messages.length, 2);
  const match = /"originalPrompt": (.*)\n\}/s.exec(messages[1].content);
  assert.ok(match, 'the user message carries the JSON evidence block');
  const original = JSON.parse(match[1]);
  assert.equal(original.length, MAX_PROMPT_CHARS);
});

test('optimizePrompt refuses a plain-HTTP remote endpoint without issuing a request', async () => {
  await withDataFile('http://api.deepseek.com', async (file) => {
    let calls = 0;
    await assert.rejects(
      optimizePrompt({
        prompt: '帮我整理灵感',
        dataFile: file,
        fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({}) }; },
      }),
      (error) => error.code === 'optimizer-insecure-endpoint',
    );
    assert.equal(calls, 0, 'no request is sent before the endpoint is validated');
  });
});

test('optimizePrompt caps the model answer length', async () => {
  await withDataFile('https://api.deepseek.com', async (file) => {
    const result = await optimizePrompt({
      prompt: '帮我整理灵感',
      dataFile: file,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '好'.repeat(MAX_OPTIMIZED_CHARS + 4000) } }] }),
      }),
    });
    assert.equal(result.prompt.length, MAX_OPTIMIZED_CHARS);
    assert.equal(result.providerId, 'deepseek');
  });
});
