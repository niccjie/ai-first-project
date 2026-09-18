'use strict';
window.ProductionAPI = (() => {
  const C = window.ProductionContract;
  // GitHub Pages is static, so its API must be a public HTTPS service.
  // Leave the fallback for the already-working local Express workflow.
  const apiBase = window.AI_CREATOR_STUDIO_API_BASE_URL || '';
  const apiPath = path => apiBase ? new URL(path, apiBase).href : path;
  function demoSeries(options) {
    const stages = ['建立设定', '冲突升级', '重大反转', '真相逼近', '高潮与结局'];
    const size = options.total_episodes / 5;
    return C.validateSeries({
      title: '《明日回声》', genre: options.genre, logline: `从“${options.idea}”出发，主角用五次关键选择找回被改写的真相。`,
      target_audience: '偏爱悬念与人物成长的年轻观众', tone: '紧凑、悬疑，结尾保留希望',
      world_setting: '近未来城市中，每个人的重大决定都会留下可追踪的数字回声。此为本地模板演示，尚未进行真实语义创作。',
      core_conflict: '林然想公开被篡改的记录，而掌控记录的人试图让所有人遗忘。', main_mystery: '究竟是谁改写了林然的第一次选择？',
      selling_points: ['决定留下可见回声', '伙伴关系随证据变化', '每阶段推进一层真相'],
      characters: [
        { name: '林然', age: '19', identity: '城市档案实习生', personality: '谨慎又执着', motivation: '找回失踪家人的记录', weakness: '容易独自承担风险', secret: '曾主动申请删除一段记忆', relationship: '与许知互相协助，但对证据有分歧', visual_identity: '黑色短发、细长眼睛、左眉浅疤、深蓝外套、清瘦身形、银色方形腕表' },
        { name: '许知', age: '20', identity: '记录修复师', personality: '理性、直接', motivation: '证明修复技术没有被滥用', weakness: '过度依赖数据', secret: '持有一份未公开的原始备份', relationship: '林然的伙伴，逐渐学会信任人的判断', visual_identity: '齐肩棕发、圆眼镜、浅色风衣、中等身材、随身红色笔记本' }
      ],
      props: [
        { name: '银色方形腕表', category: '可穿戴设备', owner: '林然', visual_identity: '磨砂银色表壳、深蓝表带，屏幕会浮现蓝色档案编号', story_function: '保存被篡改记录的碎片，是追查真相的第一把钥匙', status: '已激活，仍缺少完整权限' },
        { name: '红色修复笔记本', category: '纸质档案', owner: '许知', visual_identity: '磨旧红色封皮、黑色松紧带、内页有手写校验符号', story_function: '记录修复过程并承载原始备份线索', status: '由许知保管' }
      ],
      season_arc: stages.map((stage, i) => ({ stage, start_episode: i * size + 1, end_episode: (i + 1) * size,
        goal: `第${i + 1}阶段：${['找到异常记录来源', '调查记录背后的控制者', '揭露记忆曾被主动删除', '找到原始备份并重建信任', '公开真相并承担选择'][i]}`,
        escalation: ['个人疑问变成实际威胁', '证人开始拒绝合作', '伙伴对主角失去信任', '公开记录可能伤害无辜者', '必须在保护伙伴与公布证据间抉择'][i],
        key_twist: ['腕表藏着旧档案', '证人与失踪家人相识', '主角曾授权删除记录', '备份仍可恢复', '最终线索来自自己的第一次选择'][i] })),
      episode_outlines: Array.from({ length: options.total_episodes }, (_, i) => ({ episode_number: i + 1, title: `${stages[Math.floor(i / size)]} · 线索${i + 1}`,
        opening_hook: `编号${i + 1}的档案突然显示出不属于当前时间的画面。`, main_event: `林然与许知核对第${i + 1}份记录，在${stages[Math.floor(i / size)]}阶段推进新的证据链。`,
        conflict: `第${i + 1}份记录与证人的证词不符，两人必须决定先相信哪一方。`, twist: `记录${i + 1}的时间戳指向主角曾经忽略的决定。`,
        cliffhanger: i === options.total_episodes - 1 ? '真相公开，两人决定共同守护真实的记录。' : `一份标记为${i + 2}的档案自动解锁，下一条证据即将出现。` }))
    }, options);
  }
  function demoEpisode(series, options, number) {
    const outline = series.episode_outlines[number - 1];
    const name = series.characters[0].name;
    const partner = (series.characters[1] || series.characters[0]).name;
    const common = { episode_number: number, title: outline.title, opening_hook: outline.opening_hook,
      twist: outline.twist, cliffhanger: outline.cliffhanger,
      continuity_summary: `第${number}集结束：${name}已确认本集线索。${outline.main_event} 未解决问题：${outline.cliffhanger}` };
    if (options.type === 'novel') return C.validateEpisode({ ...common, chapter_text: `${name}推开档案室的门，熟悉的尘土气息扑面而来。${outline.opening_hook}\n\n` +
      Array.from({ length: 5 }, (_, i) => `第${i + 1}页记录带来的疑问让${name}停下了脚步。窗外的光落在纸边，那些曾经看似无关的细节，正一点一点连接起来。“先别急着下结论。”伙伴提醒道。${name}点头，却没有放下手中的记录。眼前的证据让人想起多年前那个无法挽回的决定，而这一次，谁也不愿再轻易相信一个现成的答案。`).join('\n\n') + `\n\n${outline.twist}${outline.cliffhanger}` }, options, number, series);
    // Shot count derives from the per-shot duration ceiling so every shot stays within 1.5-12s.
    const perScene = Math.max(2, Math.ceil(options.duration / 12));
    const shotCount = perScene * 2;
    const shotDuration = options.duration / shotCount;
    const shotTypes = ['极特写', '中景', '特写', '过肩', '近景', '远景'];
    const shotVisuals = [`${name}的手指停在半空，屏幕上的字还在闪。`, `${name}把记录转向${partner}。`,
      '腕表表面浮出不属于今天的日期。', `${name}的目光扫过纸页边缘。`, `${name}后退半步，撞到文件柜。`, '门外走廊的灯逐个熄灭。'];
    const shotActions = ['屏幕出现不属于今天的记录', '两人核对同一条证据', '腕表亮起', '发现日期异常', '作出决定', '门外出现人影'];
    return C.validateEpisode({ ...common,
      scenes: [
        { scene_number: 1, location: '档案室', time: '夜晚', characters: [name, partner], purpose: '发现异常记录',
          duration: options.duration / 2,
          dialogue: [{ speaker: name, line: '这条记录不是今天写的。' }, { speaker: partner, line: '别碰它，先拍下来。' }] },
        { scene_number: 2, location: '档案室走廊', time: '夜晚', characters: [name], purpose: '威胁逼近并留下悬念',
          duration: options.duration / 2,
          dialogue: [{ speaker: name, line: '谁把灯关了？' }] }
      ],
      shot_list: Array.from({ length: shotCount }, (_, i) => ({ shot_number: i + 1, scene_number: i < perScene ? 1 : 2,
        shot_type: i < perScene ? '近景' : shotTypes[i % shotTypes.length],
        visual: shotVisuals[i % shotVisuals.length].slice(0, 300), action: shotActions[i % shotActions.length].slice(0, 120),
        dialogue_line: i === 1 ? 1 : i === Math.min(2, perScene - 1) ? 2 : i === perScene ? 1 : 0, duration: shotDuration,
        image_prompt: 'Cinematic still, slim young archivist, short black hair, faint left eyebrow scar, dark blue jacket, square silver wristwatch, dim archive room, consistent face and clothing, no text',
        video_prompt: `Shot ${i + 1}, slow camera push on the same archivist with short black hair and dark blue jacket, subtle dramatic lighting, consistent face and clothing` }))
    }, options, number, series);
  }
  function delay(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('已取消', 'AbortError'));
      const cancel = () => { clearTimeout(timer); reject(new DOMException('已取消', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, 1800);
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
  async function request(path, body, signal) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 550000);
    try {
      const response = await fetch(apiPath(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => { throw Error('接口未返回有效 JSON，请通过本地服务打开页面。'); });
      if (!response.ok) throw Error(formatServerError(data));
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Error(timedOut ? '请求超时，本次未保存。' : '已取消生成，保留原有内容。');
      if (error instanceof TypeError) throw Error('无法连接 AI 服务，请检查本地服务是否运行。');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  // Diagnostics only: surface the server-side stage/code/request_id so a failure can be
  // located in server/logs/production-YYYYMMDD.ndjson. Values are short server labels.
  function formatServerError(data) {
    const base = typeof data?.error === 'string' ? data.error : '生成失败，请稍后重试。';
    const label = value => typeof value === 'string' && value && value.length <= 64 ? value : null;
    const code = label(data?.error_code), stage = label(data?.stage), requestId = label(data?.request_id);
    if (!code && !stage && !requestId) return base;
    const parts = [];
    if (stage) parts.push(`错误阶段：${stage}`);
    if (code) parts.push(`错误代码：${code}`);
    if (requestId) parts.push(`请求 ID：${requestId}`);
    return `${base}\n${parts.join('\n')}`;
  }
  async function createSeries(input, mode, signal) {
    const options = C.params(input);
    if (mode === 'demo') { await delay(signal); return demoSeries(options); }
    if (mode !== 'ai') throw Error('请选择有效模式。');
    return C.validateSeries(await request('/api/create-series', options, signal), options);
  }
  async function createEpisode(record, number, signal) {
    if (record.mode === 'demo') { await delay(signal); return demoEpisode(record.data, record.options, number); }
    const data = await request('/api/create-episode', { options: record.options, series: record.data, episode_number: number, previous_episode: record.staleEpisodes.includes(number - 1) ? null : record.episodes[number - 1] || null }, signal);
    return C.validateEpisode(C.normalizeEpisode(data, record.options, record.data), record.options, number, record.data);
  }
  return { createSeries, createEpisode, demoSeries, demoEpisode };
})();
