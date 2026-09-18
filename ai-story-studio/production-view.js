'use strict';
window.ProductionView = (() => {
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function facts(parent, data, labels) {
    const dl = node('dl', null, 'production-facts');
    Object.entries(labels).forEach(([key, label]) => {
      const row = node('div'); row.append(node('dt', label), node('dd', Array.isArray(data[key]) ? data[key].join('、') : String(data[key]))); dl.append(row);
    });
    parent.append(dl);
  }
  function disclosure(title, parent, open = false) {
    const detail = node('details', null, 'production-detail'); detail.open = open;
    detail.append(node('summary', title)); parent.append(detail); return detail;
  }
  function button(text, action) { const el = node('button', text, 'copy-button'); el.type = 'button'; el.addEventListener('click', action); return el; }
  function render(record, actions) {
    const plan = record.data;
    $('series-overview').replaceChildren(node('h4', plan.title));
    facts($('series-overview'), plan, { genre: '题材', logline: '一句话卖点', target_audience: '目标受众', tone: '整体风格', world_setting: '世界观', core_conflict: '核心冲突', main_mystery: '核心悬念' });
    const points = node('ul'); plan.selling_points.forEach(point => points.append(node('li', point))); $('series-overview').append(points);
    $('series-characters').replaceChildren();
    plan.characters.forEach(character => facts(disclosure(character.name + ' · ' + character.identity, $('series-characters')), character,
      { age: '年龄', personality: '性格', motivation: '动机', weakness: '弱点', secret: '秘密', relationship: '人物关系', visual_identity: '外观标识' }));
    const props = $('series-props'); props.replaceChildren();
    if (plan.props.length) plan.props.forEach(prop => facts(disclosure(`${prop.name} · ${prop.category}`, props), prop,
      { owner: '归属', visual_identity: '外观标识', story_function: '剧情作用', status: '当前状态' }));
    else props.append(node('p', '当前方案没有需要跨集追踪的关键道具。', 'demo-note'));
    $('series-arc').replaceChildren();
    plan.season_arc.forEach(arc => facts(disclosure(`${arc.start_episode}–${arc.end_episode} 集 · ${arc.stage}`, $('series-arc')), arc,
      { goal: '阶段目标', escalation: '冲突升级', key_twist: '关键反转' }));
    let page = Math.floor(((record.selectedEpisode || 1) - 1) / 10);
    const pages = Math.ceil(plan.episode_outlines.length / 10);
    function drawPage() {
      $('episode-list').replaceChildren();
      plan.episode_outlines.slice(page * 10, page * 10 + 10).forEach(outline => {
        const card = disclosure(`第 ${String(outline.episode_number).padStart(2, '0')} 集 · ${outline.title}${record.staleEpisodes.includes(outline.episode_number) ? ' · 旧稿待更新' : record.episodes[outline.episode_number] ? ' · 已生成' : ''}`, $('episode-list'), outline.episode_number === record.selectedEpisode);
        facts(card, outline, { opening_hook: '开场钩子', main_event: '本集事件', conflict: '冲突', twist: '反转', cliffhanger: '结尾悬念' });
        const row = node('div', null, 'result-actions');
        if (record.episodes[outline.episode_number]) row.append(button('查看本集', () => actions.select(outline.episode_number)));
        row.append(button(record.episodes[outline.episode_number] ? '重新生成本集' : '生成本集', () => actions.generate(outline.episode_number)));
        card.append(row);
      });
      $('episode-pagination').replaceChildren();
      const prev = button('上一页', () => { page--; drawPage(); }); prev.disabled = page === 0; prev.dataset.boundary = String(prev.disabled);
      const next = button('下一页', () => { page++; drawPage(); }); next.disabled = page === pages - 1; next.dataset.boundary = String(next.disabled);
      $('episode-pagination').append(prev, node('span', `${page + 1} / ${pages} 页 · 共 ${plan.episode_outlines.length} 集`), next);
    }
    drawPage();
    renderEpisode(record);
  }
  function renderEpisode(record) {
    const container = $('episode-workspace'); container.replaceChildren();
    const episode = record.episodes[record.selectedEpisode];
    if (!episode) { container.append(node('p', '选择一集并点击“生成本集”。正文按需生成，不会一次生成整季剧本。')); return; }
    container.append(node('h4', `第 ${episode.episode_number} 集 · ${episode.title}`));
    if (record.staleEpisodes.includes(episode.episode_number)) container.append(node('p', '前集已更新：这是保留的旧稿，建议重新生成本集以核对连续性。', 'field-error'));
    container.append(node('p', `本集基于${episode.episode_number === 1 ? '整季设定' : record.episodeSources?.[episode.episode_number] === 'script' ? '前集已生成内容' : '前集大纲'}接续。`, 'demo-note'));
    if (record.type === 'novel') {
      facts(container, episode, { opening_hook: '开场钩子', pacing: '节奏节点', twist: '本集反转', cliffhanger: '结尾悬念', continuity_summary: '连续性摘要' });
      container.append(node('h4', '章节正文'), node('p', episode.chapter_text, 'chapter-text'));
    } else {
      // V1 field mapping: scenes own place/cast/purpose/dialogue, shots own framing,
      // action and timing. `dialogue_line` points at a line in the owning scene.
      facts(container, episode, { opening_hook: '开场钩子', twist: '本集反转', cliffhanger: '结尾悬念', continuity_summary: '连续性摘要' });
      const sceneByNumber = new Map(episode.scenes.map(scene => [scene.scene_number, scene]));
      episode.scenes.forEach(scene => {
        const detail = disclosure(`场景 ${scene.scene_number} · ${scene.location}`, container, true);
        facts(detail, { ...scene, characters: scene.characters.join('、') }, { time: '时间', characters: '人物', purpose: '场景目的', duration: '场景时长' });
        if (!scene.dialogue.length) { detail.append(node('p', '本场无对白', 'demo-note')); return; }
        scene.dialogue.forEach((item, index) => detail.append(node('p', `${index + 1}. ${item.speaker}：${item.line}`, 'structured-text')));
      });
      const shots = disclosure(record.type === 'comic' ? '漫画分镜 / 漫剧镜头' : '初步分镜', container);
      episode.shot_list.forEach(shot => {
        const owner = sceneByNumber.get(shot.scene_number);
        const card = disclosure(`镜头 ${shot.shot_number} · 场景 ${shot.scene_number}${owner ? ` · ${owner.location}` : ''} · ${shot.shot_type} · ${shot.duration} 秒`, shots);
        const line = shot.dialogue_line > 0 ? owner?.dialogue[shot.dialogue_line - 1] : null;
        facts(card, { ...shot, dialogue_line: line ? `${line.speaker}：${line.line}` : '无对白' },
          { visual: '画面', action: '动作', dialogue_line: '对白', image_prompt: 'Image prompt', video_prompt: 'Video prompt' });
      });
    }
    const copy = button('复制本集 JSON', async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(episode, null, 2)); $('copy-status').textContent = '本集已复制。'; }
      catch { const range = document.createRange(); range.selectNodeContents(container); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('copy-status').textContent = '已选中本集，请使用系统复制。'; }
    });
    container.append(copy);
  }
  return { render, renderEpisode };
})();
