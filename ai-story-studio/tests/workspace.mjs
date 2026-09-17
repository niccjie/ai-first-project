import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = {};
for (const name of ['api.js', 'production-contract.js', 'production-api.js', 'production-view.js', 'script.js']) source[name] = await fs.readFile(new URL('../' + name, import.meta.url), 'utf8');
function setup(storage = new Map()) {
  const nodes = new Map();
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.events = {}; this.dataset = {}; this.attrs = {}; this.value = ''; this.hidden = false; this.disabled = false; this._checked = false; }
    set checked(value) { this._checked = value; if (value && this.group) this.group.forEach(other => { if (other !== this) other._checked = false; }); }
    get checked() { return this._checked; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return (this._text || '') + this.children.map(child => child.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(key, callback) { (this.events[key] ||= []).push(callback); }
    async trigger(key) { for (const callback of this.events[key] || []) await callback({ preventDefault() {} }); }
    focus() { this.focused = true; }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  }
  const el = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const radios = ['drama', 'comic', 'novel'].map(type => { const radio = new Element('input'); radio.value = type; return radio; });
  radios.forEach(r => { r.group = radios; }); radios[0].checked = true;
  el('creator-form').querySelector = selector => selector.includes(':checked') ? radios.find(r => r.checked) : radios.find(r => selector.includes(r.value));
  el('creator-form').querySelectorAll = selector => selector === 'input[name="story-type"]' ? radios : [...radios, ...['story-idea', 'story-genre', 'episode-count', 'episode-duration', 'generation-mode', 'generate-button', 'legacy-button', 'clear-button', 'example-button'].map(el)];
  el('production-results').append(...['series-overview', 'series-characters', 'series-props', 'series-arc', 'episode-list', 'episode-pagination', 'episode-workspace'].map(el));
  el('generation-mode').value = 'demo'; el('story-genre').value = '悬疑'; el('episode-count').value = '30'; el('episode-duration').value = '60';
  const window = { location: { href: 'https://static.test/', hostname: 'static.test' } };
  const sandbox = { window, console, URL, AbortController, DOMException, AbortSignal, setInterval, clearInterval,
    setTimeout: (fn, delay) => setTimeout(fn, delay === 1800 ? 5 : delay), clearTimeout,
    Blob: class { constructor(parts, options) { this.parts = parts; this.options = options; } },
    document: { querySelector: selector => el(selector.slice(1)), getElementById: el, createElement: tag => new Element(tag) },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    navigator: { clipboard: { writeText: async text => { sandbox.copied = text; } } }, fetch: async () => { throw Error('Unexpected network request'); }
  };
  vm.createContext(sandbox); Object.values(source).forEach(code => vm.runInContext(code, sandbox));
  return { el, radios, sandbox, storage, run: command => vm.runInContext(command, sandbox) };
}
for (const [count, type, duration] of [[20, 'drama', 30], [30, 'comic', 90], [50, 'novel', 60]]) {
  const app = setup(); app.el('story-idea').value = '<script>alert(1)</script> 改变命运的故事';
  app.el('episode-count').value = String(count); app.el('episode-duration').value = String(duration);
  app.radios.find(r => r.value === type).checked = true; app.run('syncDuration()');
  assert.equal(app.el('duration-field').hidden, type === 'novel');
  const first = app.run('generateSeries()'); await app.run('generateSeries()'); await first;
  assert.equal(app.run('history.length'), 1);
  assert.equal(app.run('current.data.episode_outlines.length'), count);
  assert.equal(app.run('Object.keys(current.episodes).length'), 0);
  assert.ok(app.el('series-props').textContent.includes('银色方形腕表'));
  assert.equal(app.el('episode-list').children.length, 10);
  assert.equal(app.el('episode-pagination').children[0].disabled, true);
  assert.ok(app.el('series-overview').textContent.includes('<script>'));
  await app.el('episode-pagination').children[2].trigger('click');
  assert.ok(app.el('episode-list').children[0].textContent.includes('11'));
  await app.run('generateEpisode(1)'); await app.run('generateEpisode(2)');
  assert.equal(app.run('current.episodeSources[2]'), 'script');
  assert.ok(app.el('episode-workspace').textContent.includes(type === 'novel' ? '章节正文' : '配音文本'));
  await app.run('generateEpisode(1)');
  assert.equal(app.run('current.staleEpisodes.includes(2)'), true);
  assert.ok(app.run('current.episodes[2]'));
  app.run('selectEpisode(2)'); assert.ok(app.el('episode-workspace').textContent.includes('旧稿'));
  await app.run('generateEpisode(3)'); assert.equal(app.run('current.episodeSources[3]'), 'outline');
  // Changing the form does not alter a saved season's production parameters.
  app.el('episode-duration').value = '60';
  if (type !== 'novel') assert.equal(app.run('current.episodes[3].shot_list.reduce((sum,s)=>sum+s.duration,0)'), duration);
  await app.el('copy-button').trigger('click'); assert.equal(JSON.parse(app.sandbox.copied).kind, 'series');
  const loaded = setup(app.storage);
  await loaded.el('history-list').children[0].children[0].trigger('click');
  assert.equal(loaded.run('current.data.episode_outlines.length'), count);
  assert.equal(loaded.run('Object.keys(current.episodes).length'), 3);
  // Cancelled generation preserves the previous plan and history.
  const oldTitle = loaded.run('current.data.title');
  const pending = loaded.run('generateSeries()'); loaded.run('productionController.abort()'); await pending;
  assert.equal(loaded.run('current.data.title'), oldTitle);
  assert.equal(loaded.run('busy'), false);
  assert.ok(loaded.el('request-error').textContent.includes('取消'));
}
console.log('PASS: V0.2 workspace 20/30/50, three formats, paging, no eager scripts, episode generation, stale continuity, copy, history restore, cancel, and plain-text rendering.');
