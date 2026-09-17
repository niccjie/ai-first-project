import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { createHandler } from '../backend/server.mjs';

const apiCode = await readFile(new URL('../api.js', import.meta.url), 'utf8');
const uiCode = await readFile(new URL('../script.js', import.meta.url), 'utf8');
new vm.Script(apiCode); new vm.Script(uiCode);
const fixture = Object.fromEntries(['title', 'summary', 'characters', 'outline', 'episode', 'image_prompt'].map(key => [key, `${key} content`]));
function context({ endpoint = '', fetchImpl = async () => ({ ok: true, json: async () => fixture }), storage = new Map(), brokenStorage = false } = {}) {
  const nodes = new Map();
  const makeElement = () => ({ value: '', textContent: '', hidden: false, disabled: false, checked: false, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(k, fn) { this.events[k] = fn; }, focus() { this.focused = true; },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    querySelectorAll() { return this.children.flatMap(child => child.children); }
  });
  const el = key => { if (!nodes.has(key)) nodes.set(key, makeElement()); return nodes.get(key); };
  const radios = ['drama', 'comic', 'novel'].map(type => { const node = el(type); node.value = type; return node; });
  radios[0].checked = true;
  el('#generation-mode').value = 'demo';
  el('#creator-form').querySelector = selector => selector.includes(':checked') ? radios.find(r => r.checked) : radios.find(r => selector.includes(r.value));
  el('#creator-form').querySelectorAll = () => [...radios, el('#story-idea'), el('#generate-button'), el('#generation-mode')];
  const window = { location: { href: 'http://localhost:8000/ai-story-studio/' } };
  const sandbox = { window, URL, AbortController, TypeError, fetch: fetchImpl,
    setTimeout: (fn, ms) => ms === 1800 ? setTimeout(fn, 0) : setTimeout(fn, ms), clearTimeout, setInterval, clearInterval,
    document: { querySelector: el, createElement: makeElement },
    localStorage: { getItem: key => { if (brokenStorage) throw Error('blocked'); return storage.get(key) || null; }, setItem: (key, value) => { if (brokenStorage) throw Error('full'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
    navigator: { clipboard: { writeText: async text => { sandbox.copied = text; } } }
  };
  vm.createContext(sandbox);
  vm.runInContext(apiCode.replace("endpoint: ''", `endpoint: '${endpoint}'`), sandbox);
  vm.runInContext(uiCode, sandbox);
  return { sandbox, el, radios, storage, generate: () => vm.runInContext('generate()', sandbox) };
}

const app = context();
await app.generate();
assert.equal(app.el('#story-idea').attrs['aria-invalid'], 'true');
app.el('#example-button').events.click();
assert.equal(app.el('#story-idea').value, '一个普通大学生获得改变人生的AI系统');
for (let index = 0; index < 6; index++) {
  app.radios.forEach((r, i) => { r.checked = i === index % 3; });
  app.el('#story-idea').value = `<img src=x onerror=alert(1)> 故事${index}`;
  const pending = app.generate();
  assert.equal(app.el('#generate-button').disabled, true);
  await app.generate(); // Duplicate must be ignored.
  await pending;
  assert.equal(app.el('#output-panel').attrs['aria-busy'], 'false');
  assert.ok(app.el('#story-summary').textContent.includes('<img'));
  assert.ok(app.el('#story-characters').textContent.includes('年龄：'));
  assert.ok(app.el('#story-outline').textContent.includes('第三幕'));
  assert.ok(!/[\u4e00-\u9fff]/u.test(app.el('#image-prompt').textContent));
}
const saved = JSON.parse([...app.storage.values()][0]);
assert.equal(saved.length, 5);
assert.ok(saved[0].idea.endsWith('5'));
assert.ok(saved[4].idea.endsWith('1'));
await app.el('#copy-button').events.click();
assert.ok(app.sandbox.copied.includes('Demo 模拟'));
app.el('#clear-button').events.click();
assert.equal(app.el('#story-idea').value, '');
const reload = context({ storage: app.storage });
assert.equal(reload.el('#history-list').children.length, 5);
reload.el('#history-list').children[0].children[0].events.click();
assert.equal(reload.el('#story-title').textContent, saved[0].data.title);
reload.el('#generation-mode').value = 'ai';
await reload.generate();
assert.ok(reload.el('#request-error').textContent.includes('尚未配置'));
assert.equal(reload.el('#results').hidden, false);
assert.equal(JSON.parse([...app.storage.values()][0]).length, 5);
const broken = context({ brokenStorage: true });
broken.el('#story-idea').value = '猫的故事'; await broken.generate();
assert.ok(broken.el('#history-status').textContent.includes('仅在当前页面'));
context({ storage: new Map([['niccjie.studio.history.v3', '{broken']]) });
reload.el('#clear-history').events.click();
assert.equal(app.storage.size, 0);

for (const test of [
  { response: { ok: false, status: 429 }, message: '频繁' },
  { response: { ok: true, json: async () => ({ title: 'incomplete' }) }, message: '格式' },
  { response: { ok: true, json: async () => { throw Error('bad'); } }, message: 'JSON' },
  { error: new TypeError('offline'), message: '连接失败' },
  { error: Object.assign(Error('abort'), { name: 'AbortError' }), message: '超时' }
]) {
  const client = context({ endpoint: 'https://example.test/api/generate', fetchImpl: async () => { if (test.error) throw test.error; return test.response; } });
  await assert.rejects(client.sandbox.window.StudioAPI.generate({ idea: '想法', type: 'drama', mode: 'ai' }), error => error.message.includes(test.message));
}
const real = context({ endpoint: 'https://example.test/api/generate' });
real.el('#story-idea').value = '真实请求测试'; real.el('#generation-mode').value = 'ai'; await real.generate();
assert.equal(real.el('#story-title').textContent, fixture.title);
assert.ok(real.el('#result-badge').textContent.includes('AI 生成'));

let upstreamBody;
let upstreamResult = { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(fixture) }] }] };
const backend = createServer(createHandler({ env: { OPENAI_API_KEY: 'test-only-not-a-key', OPENAI_MODEL: 'test-model', ALLOWED_ORIGIN: 'http://localhost:8000' }, fetchImpl: async (_url, options) => {
  upstreamBody = JSON.parse(options.body);
  return { ok: true, json: async () => upstreamResult };
} }));
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${backend.address().port}/api/generate`;
const headers = { Origin: 'http://localhost:8000', 'Content-Type': 'application/json' };
try {
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ idea: '一个大学生获得未来AI系统', type: 'drama' }) });
  assert.equal(response.status, 200); assert.equal(JSON.stringify(await response.json()), JSON.stringify(fixture));
  assert.equal(upstreamBody.text.format.strict, true); assert.equal(upstreamBody.store, false);
  assert.equal(upstreamBody.input, '一个大学生获得未来AI系统');
  assert.equal((await fetch(url, { method: 'OPTIONS', headers })).status, 204);
  assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://invalid.test' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers, body: '{}' })).status, 400);
  upstreamResult = { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] };
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ idea: 'x', type: 'novel' }) })).status, 422);
  upstreamResult = { status: 'incomplete' };
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ idea: 'x', type: 'comic' }) })).status, 422);
} finally { await new Promise(resolve => backend.close(resolve)); }
console.log('PASS: frontend syntax, three formats, input validation, busy state, duplicate protection, plain-text rendering, copy, clear, five-record history, reload, blocked/corrupt storage, AI success/error/invalid JSON/timeout handling, and local HTTP backend contract. No paid API calls.');
