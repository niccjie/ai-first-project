'use strict';

const $ = selector => document.querySelector(selector);
const api = window.StudioAPI;
const form = $('#creator-form');
const input = $('#story-idea');
const results = $('#results');
const status = $('#generation-status');
const storageKey = 'niccjie.studio.history.v3';
let current = null;
let busy = false;
let history = [];
let productionController = null;
const contract = window.ProductionContract;

function updateCount() {
  $('#character-count').textContent = `${input.value.length} / 500`;
  $('#idea-error').textContent = '';
  input.removeAttribute('aria-invalid');
}
function setBusy(value) {
  busy = value;
  form.querySelectorAll('input, textarea, button, select').forEach(control => { control.disabled = value; });
  $('#regenerate-button').disabled = value;
  $('#copy-button').disabled = value;
  $('#download-button').disabled = value;
  $('#history-list').querySelectorAll('button').forEach(button => { button.disabled = value; });
  $('#clear-history').disabled = value;
  $('#spinner').hidden = !value;
  $('#loading-state').hidden = !value;
  $('#output-panel').setAttribute('aria-busy', String(value));
  $('#generate-label').textContent = value ? 'AI 正在创作中...' : '生成整季策划';
  $('#production-results').querySelectorAll('button').forEach(button => { button.disabled = value || button.dataset.boundary === 'true'; });
  syncDuration();
}
function showRecord(record) {
  current = record;
  const data = record.data;
  const isSeries = record.kind === 'series';
  $('#production-results').hidden = !isSeries;
  $('#legacy-results').hidden = isSeries;
  $('#regenerate-button').textContent = isSeries ? '重新生成整季 ↻' : '重新生成 ↻';
  if (isSeries) {
    window.ProductionView.render(record, { generate: generateEpisode, select: selectEpisode });
  } else {
  // All model output and user input are rendered as plain text, never HTML.
  $('#story-title').textContent = data.title;
  $('#story-summary').textContent = data.summary;
  $('#story-characters').textContent = data.characters;
  $('#story-outline').textContent = data.outline;
  $('#story-script').textContent = data.episode;
  $('#image-prompt').textContent = data.image_prompt;
  }
  $('#script-format').textContent = { drama: '短剧 · 场景、地点、人物与对白', comic: '漫画 · 第一话分镜', novel: '小说 · 第一章叙事' }[record.type];
  $('#result-source').textContent = `创作想法：${record.idea}${isSeries ? ` · ${record.options.genre} · ${record.options.total_episodes}${record.type === 'novel' ? '章' : '集'}${record.options.duration ? ` · 每集${record.options.duration}秒` : ''}` : ''}`;
  $('#result-badge').textContent = `${api.types[record.type]} · ${record.mode === 'ai' ? 'AI 生成' : 'Demo 模拟'}`;
  $('#copy-status').textContent = '';
  results.hidden = false;
  $('#empty-state').hidden = true;
}
function readHistory() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    if (raw.length > 6000000) throw new Error('Oversized history');
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error('Invalid history');
    history = records.filter(record => {
      try {
        return record && typeof record.idea === 'string' && record.idea.trim().length > 0 && record.idea.length <= 500 && Object.hasOwn(api.types, record.type) && ['demo', 'ai'].includes(record.mode) && typeof record.time === 'string' && Number.isFinite(Date.parse(record.time)) && validRecord(record);
      } catch { return false; }
    }).slice(0, 5);
  } catch { $('#history-status').textContent = '历史记录无法读取；你仍然可以继续创作。'; }
}
function renderHistory() {
  const list = $('#history-list');
  list.replaceChildren();
  $('#history-empty').hidden = history.length > 0;
  history.forEach(record => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const title = document.createElement('strong');
    title.textContent = record.data.title;
    const meta = document.createElement('span');
    meta.textContent = `${new Date(record.time).toLocaleString('zh-CN')} · ${api.types[record.type]} · ${record.mode === 'ai' ? 'AI' : 'Demo'}`;
    button.append(title, meta);
    button.addEventListener('click', () => {
      if (busy) return;
      input.value = record.idea;
      form.querySelector(`input[value="${record.type}"]`).checked = true;
      $('#generation-mode').value = record.mode;
      if (record.kind === 'series') {
        $('#story-genre').value = record.options.genre;
        $('#episode-count').value = String(record.options.total_episodes);
        $('#episode-duration').value = String(record.options.duration || 60);
      }
      syncDuration();
      updateMode(); updateCount(); showRecord(record);
      $('#request-error').textContent = '';
      status.textContent = '已打开历史创作。重新生成会使用当前输入与所选模式。';
      $('#output-title').focus();
    });
    item.append(button); list.append(item);
  });
}
function saveRecord(record) {
  history = [record, ...history.filter(item => item !== record)].slice(0, 5);
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
    $('#history-status').textContent = '最近 5 次创作保存在此浏览器中。';
  } catch { $('#history-status').textContent = '浏览器存储不可用或已满，本次记录仅在当前页面保留。'; }
  renderHistory();
}
function updateMode() {
  const real = $('#generation-mode').value === 'ai';
  $('#mode-note').textContent = real ? (api.configured ? '真实 AI 模式：故事想法将发送至本站配置的 AI 服务。' : '真实 AI 接口尚未配置。当前可选择 Demo 模式体验完整流程。') : 'Demo 模式：本地模板模拟，不调用 AI，不上传输入。创作结果仅保存在此浏览器。';
}
async function generate() {
  if (busy) return;
  const idea = input.value.trim();
  if (!idea || idea.length > 500) {
    $('#idea-error').textContent = '请输入 1 至 500 字的故事想法。';
    input.setAttribute('aria-invalid', 'true'); input.focus(); return;
  }
  const type = form.querySelector('input[name="story-type"]:checked').value;
  const mode = $('#generation-mode').value;
  updateCount();
  $('#request-error').textContent = ''; $('#copy-status').textContent = '';
  setBusy(true); results.hidden = true; $('#empty-state').hidden = true;
  $('#result-badge').textContent = mode === 'ai' ? 'AI 创作中' : 'Demo 模拟中';
  const phases = ['正在思考故事结构...', '正在设计人物...', '正在生成剧情...'];
  let phase = 0;
  status.textContent = phases[0];
  // UX hints only; these do not measure server-side reasoning progress.
  const progress = setInterval(() => {
    phase = Math.min(phase + 1, phases.length - 1); status.textContent = phases[phase];
  }, mode === 'demo' ? 550 : 4500);
  try {
    const data = await api.generate({ idea, type, mode });
    const record = { idea, type, mode, time: new Date().toISOString(), data };
    showRecord(record); saveRecord(record);
    status.textContent = mode === 'ai' ? 'AI 创作完成，可继续修改或复制方案。' : 'Demo 模拟完成，可继续修改或复制方案。';
    $('#output-title').focus();
  } catch (error) {
    if (current) showRecord(current);
    else { $('#empty-state').hidden = false; $('#result-badge').textContent = '等待重试'; }
    status.textContent = current ? '本次未完成，保留上次创作。' : '本次创作未完成。';
    $('#request-error').textContent = error.message || 'API连接失败，请稍后重试。';
  } finally { clearInterval(progress); setBusy(false); }
}
function syncDuration() {
  const novel = form.querySelector('input[name="story-type"]:checked')?.value === 'novel';
  $('#duration-field').hidden = novel;
  $('#episode-duration').disabled = busy || novel;
  $('#planning-note').textContent = novel ? '小说按章节规划，单集生成章节正文，不使用视频时长。' : '先生成设定与多集大纲，正文仅在点击“生成本集”时生成。';
}
function validRecord(record) {
  if (record.kind !== 'series') return Boolean(api.validate(record.data));
  const options = contract.params(record.options);
  if (record.idea !== options.idea || record.type !== options.type) return false;
  contract.validateSeries(record.data, options);
  if (!record.episodes || typeof record.episodes !== 'object' || Array.isArray(record.episodes)) return false;
  for (const [key, episode] of Object.entries(record.episodes)) {
    const number = Number(key);
    if (!Number.isInteger(number) || number < 1 || number > options.total_episodes || String(number) !== key) return false;
    contract.validateEpisode(episode, options, number, record.data);
  }
  if (!Number.isInteger(record.selectedEpisode) || record.selectedEpisode < 1 || record.selectedEpisode > options.total_episodes) record.selectedEpisode = 1;
  record.staleEpisodes = Array.isArray(record.staleEpisodes) ? record.staleEpisodes.filter(n => Number.isInteger(n) && n >= 1 && n <= options.total_episodes) : [];
  record.episodeSources = record.episodeSources && typeof record.episodeSources === 'object' && !Array.isArray(record.episodeSources) ? record.episodeSources : {};
  return true;
}
async function generateSeries() {
  if (busy) return;
  let options;
  try {
    options = contract.params({ idea: input.value, type: form.querySelector('input[name="story-type"]:checked').value,
      genre: $('#story-genre').value, total_episodes: Number($('#episode-count').value), duration: Number($('#episode-duration').value) });
  } catch (error) { $('#idea-error').textContent = error.message; input.focus(); return; }
  const mode = $('#generation-mode').value;
  await productionTask(async signal => {
    const data = await window.ProductionAPI.createSeries(options, mode, signal);
    const record = { kind: 'series', idea: options.idea, type: options.type, mode, options, data,
      time: new Date().toISOString(), episodes: {}, selectedEpisode: 1, episodeSources: {}, staleEpisodes: [] };
    showRecord(record); saveRecord(record);
    status.textContent = `${mode === 'demo' ? 'Demo 整季模板' : '整季策划'}已完成，共 ${options.total_episodes} 集。现在可选择一集生成正文。`;
    $('#output-title').focus();
  }, `${mode === 'demo' ? '正在模拟整季规划' : '正在生成作品 Bible 与分批大纲'}；${options.total_episodes} 集可能需要数分钟。请勿重复提交。`, true);
}
async function productionTask(task, message, replaceResult = false) {
  if (busy) return;
  productionController = new AbortController();
  updateCount(); $('#request-error').textContent = ''; $('#copy-status').textContent = '';
  setBusy(true); $('#cancel-generation').hidden = false;
  // A single episode keeps the plan visible and uses the existing button spinner.
  $('#loading-state').hidden = !replaceResult;
  if (replaceResult) { results.hidden = true; $('#empty-state').hidden = true; }
  status.textContent = message;
  try { await task(productionController.signal); }
  catch (error) {
    if (current) showRecord(current); else { $('#empty-state').hidden = false; $('#result-badge').textContent = '等待重试'; }
    $('#request-error').textContent = error.name === 'AbortError' ? '已取消生成，保留原有内容。' : error.message;
    status.textContent = current ? '原有策划与正文已保留。' : '本次未保存，可以稍后重试。';
  } finally { productionController = null; $('#cancel-generation').hidden = true; setBusy(false); }
}
async function generateEpisode(number) {
  if (busy || current?.kind !== 'series') return;
  const record = current;
  await productionTask(async signal => {
    const previousUsed = Boolean(record.episodes[number - 1]) && !record.staleEpisodes.includes(number - 1);
    const data = await window.ProductionAPI.createEpisode(record, number, signal);
    record.episodes[number] = data;
    record.episodeSources[number] = previousUsed ? 'script' : 'outline';
    // Preserve later scripts, but mark them as stale; never use stale text as context.
    record.staleEpisodes = [...new Set([...record.staleEpisodes.filter(n => n !== number), ...Object.keys(record.episodes).map(Number).filter(n => n > number)])];
    record.selectedEpisode = number;
    showRecord(record); saveRecord(record);
    status.textContent = `第 ${number} ${record.type === 'novel' ? '章' : '集'}已完成。${record.staleEpisodes.length ? '后续已生成内容保留为旧稿，请按顺序更新以保持连续。' : '可继续生成下一集。'}`;
    $('#episode-heading').focus();
  }, `正在生成第 ${number} ${record.type === 'novel' ? '章正文' : '集剧本与分镜'}，沿用已保存的作品参数与人物设定。`);
}
function selectEpisode(number) {
  if (busy || current?.kind !== 'series') return;
  current.selectedEpisode = number;
  window.ProductionView.renderEpisode(current);
  $('#episode-heading').focus();
}
form.addEventListener('submit', event => { event.preventDefault(); generateSeries(); });
$('#regenerate-button').addEventListener('click', () => current?.kind === 'series' ? generateSeries() : generate());
$('#legacy-button').addEventListener('click', generate);
$('#cancel-generation').addEventListener('click', () => productionController?.abort());
form.querySelectorAll('input[name="story-type"]').forEach(radio => radio.addEventListener('change', syncDuration));
input.addEventListener('input', updateCount);
$('#generation-mode').addEventListener('change', updateMode);
$('#example-button').addEventListener('click', () => {
  input.value = '一个普通大学生获得改变人生的AI系统'; updateCount(); input.focus();
});
$('#clear-button').addEventListener('click', () => { input.value = ''; updateCount(); input.focus(); });
$('#clear-history').addEventListener('click', () => {
  if (busy) return;
  try {
    localStorage.removeItem(storageKey); history = []; renderHistory();
    $('#history-status').textContent = '本地历史记录已清空。';
  } catch { $('#history-status').textContent = '浏览器未允许删除历史记录，请在浏览器设置中清理站点数据。'; }
});
$('#copy-button').addEventListener('click', async () => {
  if (!current || busy) return;
  const data = current.data;
  const text = `AI Creator Studio · ${api.types[current.type]} · ${current.mode === 'ai' ? 'AI 生成' : 'Demo 模拟'}\n${data.title}\n\n故事简介\n${data.summary}\n\n人物设定\n${data.characters}\n\n剧情大纲\n${data.outline}\n\n第一集脚本\n${data.episode}\n\nAI绘画提示词\n${data.image_prompt}`;
  try { await navigator.clipboard.writeText(current.kind === 'series' ? JSON.stringify(current, null, 2) : text); $('#copy-status').textContent = '完整方案已复制。'; }
  catch {
    const selection = window.getSelection(); const range = document.createRange();
    range.selectNodeContents(results); selection.removeAllRanges(); selection.addRange(range);
    $('#copy-status').textContent = '已选中结果，请使用系统复制（Ctrl/Cmd+C）。';
  }
});
$('#download-button').addEventListener('click', () => {
  if (!current || busy) return;
  const payload = current.kind === 'series' ? current : { kind: 'legacy', ...current };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(current.data.title || 'ai-creator-studio').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)}-production.json`;
  link.click(); URL.revokeObjectURL(link.href);
  $('#copy-status').textContent = '生产 JSON 已下载。';
});
readHistory(); renderHistory(); updateMode(); syncDuration();
// Detect the local Express service, retaining Demo on static hosting.
let modeTouched = false;
$('#generation-mode').addEventListener('change', () => { modeTouched = true; });
if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  fetch('/api/health', { signal: AbortSignal.timeout(3000) })
    .then(response => response.ok ? response.json() : null)
    .then(health => {
      if (health?.service === 'ai-creator-studio' && !modeTouched && !busy && !current) {
        $('#generation-mode').value = 'ai';
        updateMode();
      }
    }).catch(() => {});
}
