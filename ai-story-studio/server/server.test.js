'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');
const fixture = { title: '测试故事', characters: '主角：小林', summary: '简介：一个故事\n剧情大纲：\n第一幕：开始\n第二幕：冲突\n第三幕：结局', episode: '场景1：学校', image_prompt: 'cinematic student in a future city' };
async function serve(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const env = { OPENAI_API_KEY: 'test-placeholder', OPENAI_MODEL: 'test-model' };
const post = (url, body, extra = {}) => fetch(url + '/api/create-story', { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
test('Express serves UI, blocks secrets, validates requests and returns five AI fields', async () => {
  let calls = 0;
  await serve({ env, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const request = JSON.parse(options.body);
    assert.equal(request.text.format.strict, true);
    assert.equal(request.text.format.schema.required.length, 5);
    assert.equal(request.input, '大学生的AI故事');
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(fixture) }] }] }) };
  } }, async url => {
    for (const asset of ['/ai-story-studio/', '/ai-story-studio/api.js', '/ai-story-studio/script.js', '/ai-story-studio/style.css', '/index.html']) assert.equal((await fetch(url + asset)).status, 200);
    for (const secret of ['/server/.env', '/ai-story-studio/server/.env', '/ai-story-studio/server/server.js', '/ai-story-studio/backend/.env', '/.env']) assert.equal((await fetch(url + secret)).status, 404);
    assert.equal((await post(url, { idea: '', type: 'drama' })).status, 400);
    assert.equal((await post(url, { idea: 'x'.repeat(501), type: 'drama' })).status, 400);
    assert.equal((await post(url, { idea: 'x', type: '__proto__' })).status, 400);
    assert.equal((await post(url, { idea: 'x', type: 'drama' }, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await fetch(url + '/api/create-story')).status, 405);
    assert.equal((await fetch(url + '/api/create-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await post(url, { idea: 'x'.repeat(9000), type: 'drama' })).status, 413);
    for (const type of ['drama', 'comic', 'novel']) {
      const response = await post(url, { idea: '大学生的AI故事', type });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), fixture);
    }
    assert.equal(calls, 3);
  });
});
test('missing configuration is explicit', async () => {
  await serve({ env: {} }, async url => {
    assert.equal((await (await fetch(url + '/api/health')).json()).configured, false);
    assert.equal((await post(url, { idea: 'x', type: 'drama' })).status, 503);
  });
});
test('upstream failures, refusal, malformed output and timeout are handled', async () => {
  for (const [mock, code] of [
    [async () => ({ ok: false, status: 401 }), 401],
    [async () => ({ ok: false, status: 429 }), 429],
    [async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) }), 422],
    [async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }), 422],
    [async () => ({ ok: true, json: async () => ({ status: 'completed', output: [] }) }), 502],
    [async (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })))), 504]
  ]) await serve({ env, fetchImpl: mock, timeoutMs: 20 }, async url => {
    assert.equal((await post(url, { idea: 'x', type: 'drama' })).status, code);
  });
});
