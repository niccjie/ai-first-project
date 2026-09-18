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
  const bundledReferencePaths = Object.freeze({
    'character_01-lin-ran.png': 'assets/references/character_01-lin-ran.png',
    'character_02-xu-zhi.png': 'assets/references/character_02-xu-zhi.png'
  });
  function referenceAsset(character, index, stored) {
    const saved = stored?.[character.name] || {};
    const filename = typeof saved.filename === 'string' ? saved.filename : '';
    return { asset_id: `character_${String(index + 1).padStart(2, '0')}`, name: character.name,
      visual_identity: character.visual_identity, reference_file: filename || null,
      preview_path: bundledReferencePaths[filename] || null,
      reference_status: filename ? (saved.approved ? 'approved_reference' : 'pending_review') : 'missing_reference' };
  }
  function referenceAssets(plan, stored) { return plan.characters.map((character, index) => referenceAsset(character, index, stored)); }
  function frameTask(shot, readiness) {
    const number = String(shot.shot_number).padStart(3, '0');
    const references = (shot.character_anchors || []).map(anchor => ({
      character: anchor.name, reference_file: anchor.reference_file,
      reference_status: anchor.reference_status
    }));
    return {
      task_id: `shot_${number}_keyframe`, shot_number: shot.shot_number,
      status: readiness ? 'ready_for_prompt_review' : 'blocked_reference_review',
      input_mode: references.length ? 'reference_guided_after_approval' : 'text_only',
      duration_seconds: shot.duration, image_prompt: shot.image_prompt,
      character_reference_assets: references,
      output: { filename: `shot_${number}_keyframe.png`, relative_path: `assets/generated/episode-keyframes/shot_${number}_keyframe.png`, aspect_ratio: '16:9' },
      review: { prompt_review_required: true, references_approved: readiness,
        note: readiness ? '可选择图像供应商后进行人工提示词复核。' : '先审核本镜头出场角色的参考资产；不会自动请求图像模型。' }
    };
  }
  function buildEpisodeProductionPack(record) {
    const episode = record?.episodes?.[record.selectedEpisode];
    if (!episode) throw Error('请先生成并选择一集，再导出生产包。');
    const plan = record.data;
    const characters = new Map(referenceAssets(plan, record.referenceAssets).map(asset => [asset.name, asset]));
    const anchorsFor = names => (names || []).map(name => characters.get(name)).filter(Boolean);
    const scenes = (episode.scenes || []).map(scene => ({
      scene_number: scene.scene_number, location: scene.location, time: scene.time,
      purpose: scene.purpose, duration: scene.duration, characters: scene.characters,
      character_anchors: anchorsFor(scene.characters), dialogue: scene.dialogue
    }));
    const sceneByNumber = new Map(scenes.map(scene => [scene.scene_number, scene]));
    const activeCharacters = [...new Set(scenes.flatMap(scene => scene.characters))];
    const missingApprovedReferences = activeCharacters.filter(name => characters.get(name)?.reference_status !== 'approved_reference');
    const shots = (episode.shot_list || []).map(shot => ({
      shot_number: shot.shot_number, scene_number: shot.scene_number, duration: shot.duration,
      shot_type: shot.shot_type, visual: shot.visual, action: shot.action, dialogue_line: shot.dialogue_line,
      characters: sceneByNumber.get(shot.scene_number)?.characters || [],
      character_anchors: sceneByNumber.get(shot.scene_number)?.character_anchors || [],
      image_prompt: shot.image_prompt, video_prompt: shot.video_prompt
    }));
    const visualReady = missingApprovedReferences.length === 0;
    return {
      format: 'ai-story-studio/episode-production-pack/v1',
      source: { title: plan.title, type: record.type, mode: record.mode, episode_number: episode.episode_number,
        target_duration_seconds: record.options.duration, source_created_at: record.time,
        stale: Boolean(record.staleEpisodes?.includes(episode.episode_number)) },
      // Text anchors are useful for prompt review, but are not reference images and cannot
      // guarantee identity consistency by themselves.
      character_anchors: [...characters.values()],
      prop_anchors: (plan.props || []).map(prop => ({ name: prop.name, category: prop.category, owner: prop.owner,
        visual_identity: prop.visual_identity, status: prop.status })),
      episode: { title: episode.title, opening_hook: episode.opening_hook, twist: episode.twist,
        cliffhanger: episode.cliffhanger, continuity_summary: episode.continuity_summary,
        chapter_text: episode.chapter_text || null },
      reference_readiness: { visual_generation_ready: visualReady,
        active_characters: activeCharacters, missing_approved_references: missingApprovedReferences,
        reason: missingApprovedReferences.length ? '仍缺少已审核的角色参考资产。' : '所有出场角色均已有已审核参考资产。' },
      scenes,
      shots,
      frame_generation_manifest: { format: 'ai-story-studio/frame-generation-manifest/v1', provider: null,
        generation_requested: false, task_count: shots.length, tasks: shots.map(shot => frameTask(shot, visualReady)) },
      continuity_notes: ['每个镜头使用其场景角色锚点，并保持服装、标志物与时间地点一致。', '正式图像或视频生成前，所有出场角色都必须有已审核参考资产。', '参考资产仅在本地项目或与生产包同一文件夹中管理，不会上传到服务端。']
    };
  }
  function downloadJSON(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename;
    link.click(); URL.revokeObjectURL(link.href);
  }
  function render(record, actions) {
    const plan = record.data;
    $('series-overview').replaceChildren(node('h4', plan.title));
    facts($('series-overview'), plan, { genre: '题材', logline: '一句话卖点', target_audience: '目标受众', tone: '整体风格', world_setting: '世界观', core_conflict: '核心冲突', main_mystery: '核心悬念' });
    const points = node('ul'); plan.selling_points.forEach(point => points.append(node('li', point))); $('series-overview').append(points);
    $('series-characters').replaceChildren();
    plan.characters.forEach(character => facts(disclosure(character.name + ' · ' + character.identity, $('series-characters')), character,
      { age: '年龄', personality: '性格', motivation: '动机', weakness: '弱点', secret: '秘密', relationship: '人物关系', visual_identity: '外观标识' }));
    const assets = $('reference-assets'); assets.replaceChildren();
    const characterAssets = referenceAssets(plan, record.referenceAssets);
    const approvedCount = characterAssets.filter(asset => asset.reference_status === 'approved_reference').length;
    assets.append(node('p', `已审核 ${approvedCount}/${characterAssets.length} 个角色参考资产；待审核资产不会进入可生成状态。`, 'demo-note'));
    characterAssets.forEach(asset => {
      const card = disclosure(`${asset.asset_id} · ${asset.name} · ${asset.reference_status}`, assets);
      facts(card, asset, { reference_file: '参考图文件', visual_identity: '外观锚点', reference_status: '审核状态' });
      if (asset.preview_path) {
        const preview = node('img'); preview.className = 'reference-preview'; preview.src = asset.preview_path;
        preview.alt = `${asset.name} 角色参考图`; card.append(preview);
      } else if (asset.reference_file) card.append(node('p', '此文件仅记录名称；将它与导出的生产包放在同一文件夹后再交给生成工具。', 'demo-note'));
      const picker = node('input'); picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/webp';
      picker.addEventListener('change', event => {
        const file = event.target.files?.[0]; if (file) actions.updateReference(asset.name, { filename: file.name, approved: false });
      });
      const approval = button(asset.reference_status === 'approved_reference' ? '取消审核' : '标为已审核', () => actions.updateReference(asset.name, { approved: asset.reference_status !== 'approved_reference' }));
      approval.disabled = !asset.reference_file;
      card.append(picker, approval);
    });
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
    const pack = button(record.type === 'novel' ? '下载本章生产包' : '下载本集生产包（含首帧清单）', () => {
      const payload = buildEpisodeProductionPack(record);
      const name = `${String(episode.episode_number).padStart(2, '0')}-${episode.title}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
      downloadJSON(`${name}-production-pack.json`, payload);
      $('copy-status').textContent = '本集生产包已下载。';
    });
    container.append(copy, pack);
  }
  return { render, renderEpisode, buildEpisodeProductionPack };
})();
