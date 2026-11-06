import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildOptimizerMessages,
  defaultOptimizerDataFile,
  optimizePrompt,
  pickOptimizerModel,
  readOptimizerModel,
} from '../src/wish-optimizer.mjs';

const MODELS = {
  chrome: { enabled: true, providerId: 'chrome-built-in', modelId: 'gemini-nano' },
  disabled: {
    enabled: false,
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    connectionConfig: { baseURL: 'https://api.deepseek.com', apiKey: 'disabled-key' },
  },
  deepseek: {
    enabled: true,
    name: '肥鱼之脑',
    providerId: 'deepseek',
    modelId: 'deepseek-v4-flash',
    connectionConfig: { baseURL: 'https://api.deepseek.com/', apiKey: 'test-key' },
  },
  other: {
    enabled: true,
    providerId: 'openai',
    modelId: 'gpt-test',
    connectionConfig: { baseURL: 'https://api.openai.com/v1', apiKey: 'other-key' },
  },
};

async function withDataFile(contents, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'note-wall-wish-'));
  const file = path.join(dir, 'prompt-optimizer-data.json');
  try {
    await writeFile(file, JSON.stringify(contents), 'utf8');
    await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function rejectsWithCode(promise, code) {
  return assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    return true;
  });
}

test('defaultOptimizerDataFile resolves the PromptOptimizer data file under APPDATA', () => {
  const file = defaultOptimizerDataFile({ APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' });
  assert.equal(
    file,
    path.join('C:\\Users\\tester\\AppData\\Roaming', '@prompt-optimizer', 'desktop', 'prompt-optimizer-data.json'),
  );
});

test('pickOptimizerModel prefers an enabled DeepSeek connection over other providers', () => {
  const picked = pickOptimizerModel({ models: JSON.stringify(MODELS) });
  assert.equal(picked.model, 'deepseek-v4-flash');
  assert.equal(picked.providerId, 'deepseek');
  assert.equal(picked.baseURL, 'https://api.deepseek.com');
  assert.equal(picked.apiKey, 'test-key');
});

test('pickOptimizerModel accepts models stored as an object and rejects an empty roster', () => {
  const picked = pickOptimizerModel({ models: MODELS });
  assert.equal(picked.model, 'deepseek-v4-flash');
  assert.throws(
    () => pickOptimizerModel({ models: { chrome: MODELS.chrome } }),
    (error) => error.code === 'optimizer-model-missing',
  );
});

test('readOptimizerModel reports a missing data file with a stable code', async () => {
  await rejectsWithCode(
    readOptimizerModel(path.join(tmpdir(), 'note-wall-missing', 'prompt-optimizer-data.json')),
    'optimizer-config-missing',
  );
});

test('buildOptimizerMessages mirrors the PromptOptimizer basic user template', () => {
  const messages = buildOptimizerMessages('  帮我想想这个点子  ');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /用户提示词基础优化助手/);
  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /"originalPrompt": "帮我想想这个点子"/);
  assert.match(messages[1].content, /请输出优化后的提示词/);
  assert.throws(() => buildOptimizerMessages('   '), (error) => error.code === 'empty-prompt');
});

test('optimizePrompt posts the template to the configured model and trims its answer', async () => {
  await withDataFile({ models: JSON.stringify(MODELS) }, async (dataFile) => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '  优化后的提示词内容  ' } }] };
        },
      };
    };
    const result = await optimizePrompt({ prompt: '原始提示词', dataFile, fetchImpl });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
    assert.equal(calls[0].init.headers.authorization, 'Bearer test-key');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, 'deepseek-v4-flash');
    assert.equal(body.stream, false);
    assert.equal(body.messages[0].role, 'system');
    assert.match(body.messages[1].content, /"originalPrompt": "原始提示词"/);
    assert.equal(result.prompt, '优化后的提示词内容');
    assert.equal(result.providerId, 'deepseek');
    assert.equal('apiKey' in result, false);
  });
});

test('optimizePrompt surfaces HTTP, empty-answer and timeout failures', async () => {
  await withDataFile({ models: JSON.stringify(MODELS) }, async (dataFile) => {
    await rejectsWithCode(
      optimizePrompt({
        prompt: 'x',
        dataFile,
        fetchImpl: async () => ({ ok: false, status: 500, async json() { return {}; } }),
      }),
      'optimizer-request-failed',
    );
    await rejectsWithCode(
      optimizePrompt({
        prompt: 'x',
        dataFile,
        fetchImpl: async () => ({ ok: true, async json() { return { choices: [] }; } }),
      }),
      'optimizer-empty-response',
    );
    await rejectsWithCode(
      optimizePrompt({
        prompt: 'x',
        dataFile,
        fetchImpl: async () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          throw error;
        },
      }),
      'optimizer-timeout',
    );
  });
});
