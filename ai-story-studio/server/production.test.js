'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createApp } = require('./server');
const C = require('../production-contract');

// Test fixtures only. No .env access and no external provider calls.
const sandbox = { window: { ProductionContract: C } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../production-api.js'), 'utf8'), sandbox);
const demo = sandbox.window.ProductionAPI;
const env = { DEEPSEEK_API_KEY: 'test-placeholder', DEEPSEEK_MODEL: 'test-model' };
const options = (total = 30, type = 'drama', duration = 60) => ({ idea: '一个大学生发现记忆被修改', type, genre: '悬疑', total_episodes: total, duration: type === 'novel' ? null : duration });
const envelope = data => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }) });
async function serve(extra, run) {
  const server = createApp({ env, productionLogger: () => {}, ...extra }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (url, route, body) => fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function provider(opts, calls, mutate = data => data) {
  const plan = demo.demoSeries(opts);
  return async (url, request) => {
    assert.equal(url, 'https://api.deepseek.com/v1/responses');
    const body = JSON.parse(request.body);
    calls.push(body);
    assert.equal(body.store, false); assert.deepEqual(body.reasoning, { effort: 'none' }); assert.equal(body.max_output_tokens, 6000);
    assert.equal(body.text.format.strict, true);
    const input = JSON.parse(body.input);
    let result;
    if (body.text.format.name === 'series_bible') { const { episode_outlines, ...bible } = plan; result = bible; }
    else if (body.text.format.name === 'episode_outline_batch') result = { episode_outlines: plan.episode_outlines.slice(input.range.start - 1, input.range.end) };
    else result = demo.demoEpisode(plan, opts, input.episode_outline.episode_number);
    return envelope(mutate(result, body));
  };
}
for (const total of [20, 30, 50]) test(`${total} episodes: exact sequential outlines, five arcs, no full episode generation`, async () => {
  const opts = options(total), calls = [];
  await serve({ fetchImpl: provider(opts, calls) }, async url => {
    const response = await post(url, '/api/create-series', opts);
    assert.equal(response.status, 200);
    const plan = await response.json(); C.validateSeries(plan, opts);
    assert.equal(plan.episode_outlines.length, total);
    assert.equal(calls.length, 1 + total / 10);
    assert.ok(calls.every(call => call.text.format.name !== 'episode_production'));
    assert.equal(JSON.parse(calls.at(-1).input).previous_outlines.length, total - 10);
    const { episode_outlines, ...bible } = plan;
    for (let i = 1; i < calls.length; i++) {
      const input = JSON.parse(calls[i].input);
      assert.deepEqual(input.bible, bible);
      assert.deepEqual(input.previous_outlines, episode_outlines.slice(0, (i - 1) * 10));
      assert.deepEqual(input.range, { start: (i - 1) * 10 + 1, end: i * 10 });
    }
    assert.equal(plan.season_arc.at(-1).end_episode, total);
  });
});
for (const type of ['drama', 'comic', 'novel']) test(`${type}: generate one episode with previous context and correct output form`, async () => {
  const opts = options(30, type), calls = [], plan = demo.demoSeries(opts);
  const previous = demo.demoEpisode(plan, opts, 1);
  await serve({ fetchImpl: provider(opts, calls) }, async url => {
    const response = await post(url, '/api/create-episode', { options: opts, series: plan, episode_number: 2, previous_episode: previous });
    assert.equal(response.status, 200); const result = await response.json(); C.validateEpisode(result, opts, 2, plan);
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].input);
    assert.equal(payload.previous_episode.continuity_summary, previous.continuity_summary);
    assert.equal(payload.previous_outline.episode_number, 1);
    assert.equal(payload.next_outline.episode_number, 3);
    if (type === 'novel') { assert.ok(result.chapter_text.length >= 300); assert.equal(result.scenes, undefined); assert.equal(result.shot_list, undefined); }
    else {
      assert.equal(result.shot_list.reduce((n, s) => n + s.duration, 0), opts.duration);
      // V1 production shape: no duplicated narrative fields, scene<->shot linkage intact.
      assert.equal(result.voiceover, undefined); assert.equal(result.pacing, undefined);
      assert.ok(result.scenes.every(scene => !('action' in scene)));
      const sceneNumbers = new Set(result.scenes.map(scene => scene.scene_number));
      assert.equal(sceneNumbers.size, result.scenes.length);
      for (const shot of result.shot_list) {
        assert.ok(sceneNumbers.has(shot.scene_number), 'shot must reference a real scene');
        if (shot.dialogue_line !== 0) {
          const owner = result.scenes.find(scene => scene.scene_number === shot.scene_number);
          assert.ok(shot.dialogue_line <= owner.dialogue.length, 'dialogue_line must reference a real line');
        }
      }
      for (const scene of result.scenes) {
        for (const item of scene.dialogue) assert.ok(plan.characters.some(c => c.name === item.speaker));
      }
    }
  });
});
test('invalid input and inconsistent plans are rejected before any provider request', async () => {
  let calls = 0;
  const opts = options(), plan = demo.demoSeries(opts);
  await serve({ fetchImpl: async () => { calls++; throw Error('Must not call'); } }, async url => {
    for (const changes of [{ total_episodes: 40 }, { duration: 5 }, { genre: 'invalid' }, { type: '__proto__' }, { idea: '' }]) assert.equal((await post(url, '/api/create-series', { ...opts, ...changes })).status, 400);
    for (const number of [0, 31, '2']) assert.equal((await post(url, '/api/create-episode', { options: opts, series: plan, episode_number: number })).status, 400);
    assert.equal((await post(url, '/api/create-episode', { options: opts, series: plan, episode_number: 3, previous_episode: demo.demoEpisode(plan, opts, 1) })).status, 400);
    const bad = structuredClone(plan); bad.episode_outlines.pop();
    assert.equal((await post(url, '/api/create-episode', { options: opts, series: bad, episode_number: 1 })).status, 400);
    assert.equal(calls, 0);
  });
});
test('truncated, duplicate and structurally invalid generations never become successful plans', async () => {
  for (const mutate of [
    data => data.episode_outlines ? { episode_outlines: data.episode_outlines.slice(1) } : data,
    data => { if (data.episode_outlines) data.episode_outlines[1].episode_number = data.episode_outlines[0].episode_number; return data; },
    data => { if (data.season_arc) data.season_arc[1].start_episode--; return data; }
  ]) await serve({ fetchImpl: provider(options(), [], mutate) }, async url => {
    assert.equal((await post(url, '/api/create-series', options())).status, 422);
  });
});
test('production errors and timeouts do not retry paid calls', async () => {
  for (const [mock, expected] of [
    [async () => ({ ok: false, status: 429 }), 429],
    [async () => ({ ok: false, status: 401 }), 401],
    [async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) }), 422],
    [async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }), 422],
    [async (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error('timeout'), { name: 'TimeoutError' })))), 504]
  ]) {
    let calls = 0;
    await serve({ productionTimeoutMs: 20, fetchImpl: (...args) => { calls++; return mock(...args); } }, async url => {
      assert.equal((await post(url, '/api/create-series', options())).status, expected); assert.equal(calls, 1);
    });
  }
});
test('single episode validation checks duration, character identity and English prompts', () => {
  for (const duration of [30, 60, 90]) {
    const opts = options(20, 'comic', duration), plan = demo.demoSeries(opts);
    C.validateEpisode(demo.demoEpisode(plan, opts, 1), opts, 1, plan);
  }
  const opts = options(), plan = demo.demoSeries(opts);
  for (const corrupt of [episode => { episode.shot_list[0].duration += 10; }, episode => { episode.scenes[0].characters = ['陌生人']; }, episode => { episode.shot_list[0].image_prompt = '中文提示'; }]) {
    const episode = demo.demoEpisode(plan, opts, 1); corrupt(episode); assert.throws(() => C.validateEpisode(episode, opts, 1, plan));
  }
});
test('V1 episode validation enforces scene/dialogue linkage with machine-readable codes', () => {
  const opts = options(), plan = demo.demoSeries(opts);
  const owner = episode => episode.scenes.find(scene => scene.scene_number === episode.shot_list[0].scene_number);
  for (const [code, corrupt] of [
    ['duplicate_scene_number', episode => { episode.scenes[1].scene_number = episode.scenes[0].scene_number; }],
    ['shot_scene_reference', episode => { episode.shot_list[0].scene_number = 5; }],
    ['dialogue_line_reference', episode => { episode.shot_list[0].dialogue_line = owner(episode).dialogue.length + 1; }],
    ['unknown_dialogue_speaker', episode => { episode.scenes.find(scene => scene.dialogue.length).dialogue[0].speaker = '陌生人'; }],
    ['unknown_scene_character', episode => { episode.scenes[0].characters = ['陌生人']; }],
    ['prompt_not_english', episode => { episode.shot_list[0].video_prompt = '中文提示'; }],
    ['shot_numbering', episode => { episode.shot_list[0].shot_number = 9; }],
    ['shot_duration_total', episode => { episode.shot_list[0].duration += 5; }]
  ]) {
    const episode = demo.demoEpisode(plan, opts, 1); corrupt(episode);
    assert.throws(() => C.validateEpisode(episode, opts, 1, plan), error => error.code === code, `expected ${code}`);
  }
  // Loose duration tolerance: a legal output must not be discarded over rounding.
  const drifted = demo.demoEpisode(plan, opts, 1);
  drifted.shot_list[0].duration += 0.4;
  C.validateEpisode(drifted, opts, 1, plan);
});
test('legacy V0.2 episodes migrate to V1 without losing usable content', () => {
  const opts = options(), plan = demo.demoSeries(opts);
  const legacy = {
    episode_number: 1, title: '旧稿', opening_hook: '旧钩子', twist: '旧反转', cliffhanger: '旧悬念', continuity_summary: '旧摘要',
    pacing: '旧节奏节点', voiceover: '旧旁白文本',
    scenes: [{ scene_number: 1, location: '档案室', time: '夜晚', characters: [plan.characters[0].name], action: '旧场景动作', dialogue: `${plan.characters[0].name}：“旧台词。”` }],
    shot_list: Array.from({ length: 6 }, (_, i) => ({ shot_number: i + 1, shot_type: '中景', visual: `画面${i + 1}`, action: `动作${i + 1}`,
      dialogue: '无对白', duration: opts.duration / 6, image_prompt: `Shot ${i + 1}, no text`, video_prompt: `Shot ${i + 1}, static` }))
  };
  const snapshot = JSON.stringify(legacy);
  const migrated = C.normalizeEpisode(legacy, opts, plan);
  assert.equal(JSON.stringify(legacy), snapshot, 'migration must not mutate the stored record');
  C.validateEpisode(migrated, opts, 1, plan);
  assert.equal(migrated.pacing, undefined); assert.equal(migrated.voiceover, undefined);
  assert.equal(migrated.scenes[0].action, undefined); assert.equal(migrated.scenes[0].purpose, '旧场景动作');
  assert.deepEqual(migrated.scenes[0].dialogue, [{ speaker: plan.characters[0].name, line: '旧台词。' }]);
  assert.ok(migrated.shot_list.every(shot => Number.isInteger(shot.scene_number)));
  // The novel path must be untouched by migration.
  const nopts = options(20, 'novel'), nplan = demo.demoSeries(nopts), novel = demo.demoEpisode(nplan, nopts, 1);
  assert.equal(C.normalizeEpisode(novel, nopts, nplan), novel);
});
test('duration normalization keeps AI pacing within bounds and derives scene durations', () => {
  const opts = options(), plan = demo.demoSeries(opts), episode = demo.demoEpisode(plan, opts, 1);
  episode.shot_list.forEach((shot, index) => { shot.duration = [1.5, 2, 4, 6, 8, 10][index % 6]; });
  const normalized = C.normalizeEpisode(episode, opts, plan);
  assert.equal(normalized.shot_list.reduce((sum, shot) => sum + shot.duration, 0), opts.duration);
  assert.ok(normalized.shot_list.every(shot => shot.duration >= 1.5 && shot.duration <= 12));
  for (const scene of normalized.scenes) {
    const shotTotal = normalized.shot_list.filter(shot => shot.scene_number === scene.scene_number).reduce((sum, shot) => sum + shot.duration, 0);
    assert.equal(scene.duration, shotTotal);
  }
  C.validateEpisode(normalized, opts, 1, plan);
  assert.throws(() => C.normalizeShotDurations([{ duration: 4 }, { duration: 4 }, { duration: 4 }], 90), error => error.code === 'shot_duration_unachievable');
});
test('limits apply to new endpoints and cross-origin requests remain blocked', async () => {
  const opts = options(), plan = demo.demoSeries(opts), calls = [];
  await serve({ fetchImpl: provider(opts, calls) }, async url => {
    for (let i = 0; i < 10; i++) assert.equal((await post(url, '/api/create-episode', { options: opts, series: plan, episode_number: 1 })).status, 200);
    assert.equal((await post(url, '/api/create-series', opts)).status, 429);
    assert.equal((await fetch(url + '/api/create-series', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.test' }, body: JSON.stringify(opts) })).status, 403);
    assert.equal((await fetch(url + '/api/create-episode')).status, 405);
  });
});

const capture = logs => (context, event, details) => logs.push({ ...context, event, ...details });
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
test('incomplete logs pinpoint Bible or later batch, usage and reason; no continuation or retry', async () => {
  for (const failAt of [1, 2, 3, 4]) {
    const logs = [], calls = [], opts = options();
    const valid = provider(opts, calls);
    let attempts = 0;
    await serve({ productionLogger: capture(logs), fetchImpl: (...args) => {
      attempts++;
      return attempts === failAt ? reply({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
        usage: { input_tokens: 1200, output_tokens: 6000, total_tokens: 7200, output_tokens_details: { reasoning_tokens: 4900 } },
        output: [{ type: 'reasoning', content: [{ type: 'reasoning_text', text: 'PRIVATE_THINKING' }] }] }) : valid(...args);
    } }, async url => {
      const response = await post(url, '/api/create-series', opts);
      assert.equal(response.status, 422);
      assert.match((await response.json()).error, /输出未完成/);
    });
    assert.equal(attempts, failAt);
    const entry = logs.find(log => log.event === 'upstream_response' && log.deepseek_status === 'incomplete');
    assert.equal(entry.http_status, 200);
    assert.equal(entry.request_index, failAt);
    assert.equal(entry.total_requests, 4);
    assert.equal(entry.stage, failAt === 1 ? 'series_bible' : 'episode_outline_batch');
    assert.equal(entry.incomplete_reason, 'max_output_tokens');
    assert.equal(entry.usage.reasoning_tokens, 4900);
    assert.equal(entry.usage.output_tokens, 6000);
    if (failAt > 1) {
      assert.equal(entry.outline_batch, failAt - 1);
      assert.equal(entry.range_start, (failAt - 2) * 10 + 1);
      assert.equal(entry.previous_outlines_count, (failAt - 2) * 10);
    }
    assert.equal(new Set(logs.map(log => log.request_id)).size, 1);
    assert.equal(logs.at(-1).event, 'generation_failed');
    assert.equal(logs.at(-1).retry, false);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE_THINKING'));
  }
});
test('documented Responses envelope accepts reasoning before message and multiple output_text parts', async () => {
  const opts = options(20), calls = [], logs = [], valid = provider(opts, calls);
  await serve({ productionLogger: capture(logs), fetchImpl: async (...args) => {
    const body = await (await valid(...args)).json();
    const text = body.output[0].content[0].text, half = Math.floor(text.length / 2);
    body.output = [{ type: 'reasoning', content: [{ type: 'reasoning_text', text: 'PRIVATE_REASONING' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: text.slice(0, half) }, { type: 'output_text', text: text.slice(half) }] }];
    return reply(body);
  } }, async url => assert.equal((await post(url, '/api/create-series', opts)).status, 200));
  assert.equal(calls.length, 3);
  assert.equal(logs.at(-1).event, 'generation_complete');
  const output = JSON.stringify(logs);
  for (const privateText of ['PRIVATE_REASONING', opts.idea, 'test-placeholder', demo.demoSeries(opts).title]) assert.ok(!output.includes(privateText));
});
test('non-2xx reads safe error categories without echoing messages, headers or credentials', async () => {
  for (const status of [400, 401, 429, 500]) {
    const logs = []; let calls = 0;
    await serve({ productionLogger: capture(logs), fetchImpl: async () => {
      calls++;
      return reply({ error: { type: 'invalid_request_error', code: 'invalid_json_schema',
        message: 'json_schema invalid; Authorization: Bearer SYNTHETIC_SECRET; 私有故事内容', extra: 'PRIVATE_EXTRA' },
        headers: { Authorization: 'SYNTHETIC_SECRET' } }, status);
    } }, async url => assert.equal((await post(url, '/api/create-series', options())).status, [401, 429].includes(status) ? status : 502));
    assert.equal(calls, 1);
    const entry = logs.find(log => log.event === 'upstream_http_error');
    assert.equal(entry.http_status, status);
    assert.equal(entry.error_type, 'invalid_request_error');
    assert.equal(entry.error_code, 'invalid_json_schema');
    assert.equal(entry.error_message, 'structured_output_parameter');
    for (const value of ['Authorization', 'SYNTHETIC_SECRET', '私有故事内容', 'PRIVATE_EXTRA', 'test-placeholder']) assert.ok(!JSON.stringify(logs).includes(value));
  }
});
test('failed, missing status, invalid JSON, empty output and schema failures have distinct safe diagnostics', async () => {
  for (const [response, status, reason] of [
    [reply({ status: 'failed', error: { code: 'server_error', message: 'PRIVATE_ERROR' } }), 502, 'upstream_failed'],
    [reply({ output: [] }), 502, 'unexpected_response_envelope'],
    [reply({ status: 'PRIVATE_STATUS', output: [] }), 502, 'unexpected_response_envelope'],
    [{ ok: true, status: 200, json: async () => { throw SyntaxError('PRIVATE_ENVELOPE'); } }, 502, 'response_json_invalid'],
    [reply({ status: 'completed', output: [] }), 422, 'output_text_missing'],
    [reply({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{PRIVATE_JSON' }] }] }), 422, 'output_json_invalid'],
    [envelope({ title: 'PRIVATE_STORY' }), 422, 'validation_failed'],
    [reply({ status: 'incomplete', incomplete_details: { reason: 'content_filter' } }), 422, 'content_filter'],
    [reply({ status: 'incomplete', incomplete_details: { reason: 'PRIVATE_REASON' }, usage: { output_tokens: 'PRIVATE_USAGE' } }), 422, 'unrecognized']
  ]) {
    const logs = []; let calls = 0;
    await serve({ productionLogger: capture(logs), fetchImpl: async () => { calls++; return response; } }, async url => {
      const result = await post(url, '/api/create-series', options());
      assert.equal(result.status, status);
      assert.ok(!JSON.stringify(await result.json()).includes('PRIVATE_'));
    });
    assert.equal(calls, 1);
    assert.equal(logs.find(log => log.event === 'request_failed').reason, reason);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
    if (reason === 'validation_failed') assert.equal(logs.find(log => log.event === 'validation_failed').reason, '结果字段不完整或含多余字段');
  }
});
test('semantic validation records local reason and field paths without generated values', async () => {
  for (const [mutate, reason] of [
    [data => { if (data.characters) data.characters[0].age = 20; return data; }, '结果.characters[1].age文本为空或长度不符'],
    [data => { if (data.season_arc) data.season_arc[1].start_episode--; return data; }, '故事阶段集数有遗漏或重叠']
  ]) {
    const logs = [], calls = [];
    await serve({ productionLogger: capture(logs), fetchImpl: provider(options(), calls, mutate) }, async url => assert.equal((await post(url, '/api/create-series', options())).status, 422));
    assert.equal(calls.length, 1);
    assert.equal(logs.find(log => log.event === 'validation_failed').reason, reason);
  }
});
test('non-JSON HTTP errors and transport failures log safely without retries', async () => {
  for (const [mock, status, reason] of [
    [async () => ({ ok: false, status: 503, json: async () => { throw SyntaxError('PRIVATE_HTML'); } }), 502, 'upstream_http_error'],
    [async () => { throw TypeError('PRIVATE_NETWORK'); }, 502, 'connection_error'],
    [async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error('PRIVATE_TIMEOUT'), { name: 'TimeoutError' })))), 504, 'timeout_or_cancelled']
  ]) {
    const logs = []; let calls = 0;
    await serve({ productionLogger: capture(logs), productionTimeoutMs: 20, fetchImpl: (...args) => { calls++; return mock(...args); } }, async url => assert.equal((await post(url, '/api/create-series', options())).status, status));
    assert.equal(calls, 1);
    assert.equal(logs.find(log => log.event === 'request_failed').reason, reason);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  }
});
test('default terminal writer logs only sanitized provider fields', t => {
  const { responseDetails, writeDiagnostic } = require('./production-diagnostics');
  const lines = [];
  t.mock.method(console, 'info', (...args) => lines.push(args));
  writeDiagnostic({ request_id: 'local-test', stage: 'series_bible', request_index: 1, http_status: 200 }, 'upstream_response', responseDetails({
    status: 'incomplete', incomplete_details: { reason: 'max_output_tokens', extra: 'PRIVATE_DETAILS' },
    error: { message: 'PRIVATE_MESSAGE', type: 'PRIVATE_TYPE', code: 'PRIVATE_CODE' },
    usage: { input_tokens: 100, output_tokens: 6000, output_tokens_details: { reasoning_tokens: 5900, extra: 'PRIVATE_USAGE' } },
    output: [{ content: [{ text: 'PRIVATE_OUTPUT' }] }]
  }));
  assert.equal(lines[0][0], '[production]');
  const record = JSON.parse(lines[0][1]);
  assert.equal(record.error_type, 'unrecognized');
  assert.equal(record.error_code, 'unrecognized');
  assert.equal(record.error_message, 'provider_message_redacted');
  assert.equal(record.usage.reasoning_tokens, 5900);
  assert.equal(record.request_index, 1);
  assert.ok(!lines[0][1].includes('PRIVATE_'));
});
