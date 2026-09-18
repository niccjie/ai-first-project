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
  el('production-results').append(...['series-overview', 'series-characters', 'series-props', 'reference-assets', 'series-arc', 'episode-list', 'episode-pagination', 'episode-workspace'].map(el));
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
  assert.equal(app.el('reference-assets').querySelectorAll('img').length, 2, 'bundled demo references render as local previews');
  assert.ok(app.el('reference-assets').textContent.includes('已审核 0/2'), 'new references stay pending until a reviewer approves them');
  await app.el('episode-pagination').children[2].trigger('click');
  assert.ok(app.el('episode-list').children[0].textContent.includes('11'));
  await app.run('generateEpisode(1)'); await app.run('generateEpisode(2)');
  assert.equal(app.run('current.episodeSources[2]'), 'script');
  assert.ok(app.el('episode-workspace').textContent.includes(type === 'novel' ? '章节正文' : '场景目的'));
  if (type !== 'novel') {
    // V1 mapping: no pacing/voiceover blocks, shots show their owning scene and resolved line.
    const workspace = app.el('episode-workspace').textContent;
    assert.ok(!workspace.includes('节奏节点'), 'pacing must not be rendered');
    assert.ok(!workspace.includes('配音文本'), 'voiceover must not be rendered');
    assert.ok(workspace.includes('场景 1'), 'shots must show their scene');
    assert.equal(app.run('current.episodes[1].voiceover'), undefined);
    assert.equal(app.run('current.episodes[1].pacing'), undefined);
    assert.ok(app.run('current.episodes[1].scenes[0].dialogue[0].speaker').length > 0);
  }
  await app.run('generateEpisode(1)');
  assert.equal(app.run('current.staleEpisodes.includes(2)'), true);
  assert.ok(app.run('current.episodes[2]'));
  app.run('selectEpisode(2)'); assert.ok(app.el('episode-workspace').textContent.includes('旧稿'));
  await app.run('generateEpisode(3)'); assert.equal(app.run('current.episodeSources[3]'), 'outline');
  const firstCharacter = app.run('current.data.characters[0].name');
  app.run(`updateReferenceAsset(${JSON.stringify(firstCharacter)}, { filename: 'lead-reference.png', approved: true })`);
  assert.equal(app.el('reference-assets').querySelectorAll('img').length, 1, 'only bundled project-relative assets may render a preview after rerendering');
  const productionPack = app.run('window.ProductionView.buildEpisodeProductionPack(current)');
  assert.equal(productionPack.format, 'ai-story-studio/episode-production-pack/v1');
  assert.equal(productionPack.character_anchors[0].asset_id, 'character_01');
  assert.equal(productionPack.character_anchors[0].reference_file, 'lead-reference.png');
  assert.equal(productionPack.character_anchors[0].reference_status, 'approved_reference');
  assert.equal(productionPack.source.stale, false);
  assert.equal(productionPack.frame_generation_manifest.provider, null);
  assert.equal(productionPack.frame_generation_manifest.generation_requested, false);
  assert.equal(productionPack.frame_generation_manifest.task_count, productionPack.shots.length);
  if (type !== 'novel') {
    assert.equal(productionPack.shots.reduce((sum, shot) => sum + shot.duration, 0), duration);
    for (const scene of productionPack.scenes) assert.equal(scene.duration, productionPack.shots.filter(shot => shot.scene_number === scene.scene_number).reduce((sum, shot) => sum + shot.duration, 0));
    assert.equal(productionPack.reference_readiness.visual_generation_ready, false);
    assert.ok(!productionPack.reference_readiness.missing_approved_references.includes(firstCharacter));
    assert.ok(productionPack.frame_generation_manifest.tasks.every(task => task.status === 'blocked_reference_review'));
    assert.ok(productionPack.frame_generation_manifest.tasks.every(task => task.output.relative_path.startsWith('assets/generated/episode-keyframes/')));
    assert.ok(app.el('episode-workspace').textContent.includes('首帧任务清单'));
    assert.ok(app.el('episode-workspace').textContent.includes('blocked_reference_review'));
    for (const shot of productionPack.shots) {
      const scene = productionPack.scenes.find(item => item.scene_number === shot.scene_number);
      assert.deepEqual([...shot.characters], [...scene.characters]);
      assert.deepEqual(shot.character_anchors.map(anchor => ({ name: anchor.name, visual_identity: anchor.visual_identity })), scene.character_anchors.map(anchor => ({ name: anchor.name, visual_identity: anchor.visual_identity })));
    }
  }
  if (type === 'novel') {
    assert.equal(productionPack.frame_generation_manifest.tasks.length, 0);
    assert.equal(productionPack.reference_readiness.visual_generation_ready, false);
    assert.equal(productionPack.reference_readiness.reason, '小说模式不生成镜头首帧任务。');
    assert.equal(productionPack.chapter_writing_manifest.status, 'draft_ready_for_human_review');
    assert.equal(productionPack.chapter_writing_manifest.output.relative_path, 'chapters/chapter_003.md');
    assert.ok(app.el('episode-workspace').textContent.includes('章节交接清单'));
  } else assert.equal(productionPack.chapter_writing_manifest, null);
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
// Legacy V0.2 history: an episode saved in the old shape must still load, be migrated in
// memory, and render — without deleting the record and without rewriting localStorage.
{
  const source = setup();
  source.el('story-idea').value = '旧历史兼容测试';
  await source.run('generateSeries()');
  const stored = JSON.parse([...source.storage.values()][0]);
  const legacyEpisode = {
    episode_number: 1, title: '旧稿标题', opening_hook: '旧钩子', twist: '旧反转', cliffhanger: '旧悬念',
    continuity_summary: '旧连续性摘要', pacing: '旧节奏节点', voiceover: '旧旁白文本',
    scenes: [{ scene_number: 1, location: '档案室', time: '夜晚', characters: [stored[0].data.characters[0].name],
      action: '旧场景动作', dialogue: `${stored[0].data.characters[0].name}：“旧台词。”` }],
    shot_list: Array.from({ length: 6 }, (_, i) => ({ shot_number: i + 1, shot_type: '中景', visual: `旧画面${i + 1}`,
      action: `旧动作${i + 1}`, dialogue: '无对白', duration: stored[0].options.duration / 6,
      image_prompt: `Legacy shot ${i + 1}, no text`, video_prompt: `Legacy shot ${i + 1}, static` }))
  };
  stored[0].episodes = { 1: legacyEpisode };
  stored[0].selectedEpisode = 1;
  const storage = new Map([['niccjie.studio.history.v3', JSON.stringify(stored)]]);
  const app = setup(storage);
  assert.equal(app.run('history.length'), 1, 'legacy record must not be dropped');
  await app.el('history-list').children[0].children[0].trigger('click');
  const migrated = app.run('current.episodes[1]');
  assert.equal(migrated.pacing, undefined);
  assert.equal(migrated.voiceover, undefined);
  assert.equal(migrated.scenes[0].action, undefined);
  assert.equal(migrated.scenes[0].purpose, '旧场景动作');
  assert.equal(migrated.scenes[0].dialogue[0].line, '旧台词。');
  assert.equal(typeof migrated.shot_list[0].scene_number, 'number');
  assert.ok(app.el('episode-workspace').textContent.includes('场景目的'));
  const raw = JSON.parse(storage.get('niccjie.studio.history.v3'));
  assert.ok(raw[0].episodes['1'].voiceover, 'localStorage must keep the original legacy payload');
}
console.log('PASS: V0.2 workspace 20/30/50, three formats, paging, no eager scripts, episode generation, stale continuity, copy, history restore, cancel, plain-text rendering, and V0.2->V1 legacy history migration.');
