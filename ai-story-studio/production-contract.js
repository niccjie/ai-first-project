'use strict';
// Shared, credential-free schemas and validation for the browser and server.
(function (root, factory) {
  const contract = factory();
  if (typeof module === 'object' && module.exports) module.exports = contract;
  else root.ProductionContract = contract;
})(typeof window === 'object' ? window : globalThis, () => {
  // Machine-readable validation fault. Validation rules and messages are unchanged;
  // `code` only lets diagnostics name the failing rule without logging field values.
  class ContractError extends Error {
    constructor(code, message) { super(message); this.name = 'ContractError'; this.code = code; }
  }
  const genres = ['悬疑', '都市', '校园', '爱情', '科幻', '逆袭', '重生', '其他'];
  const types = ['drama', 'comic', 'novel'];
  const text = (maxLength = 1500, minLength = 1) => ({ type: 'string', minLength, maxLength });
  const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
  const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
  const array = (items, minItems, maxItems = minItems) => ({ type: 'array', items, minItems, maxItems });
  const character = object(Object.fromEntries(['name', 'age', 'identity', 'personality', 'motivation', 'weakness', 'secret', 'relationship', 'visual_identity'].map(key => [key, text(500)])));
  const prop = object({ name: text(100), category: text(100), owner: text(100), visual_identity: text(500), story_function: text(500), status: text(200) });
  const arc = object({ stage: text(100), start_episode: integer(1, 50), end_episode: integer(1, 50), goal: text(500), escalation: text(500), key_twist: text(500) });
  const outline = object({ episode_number: integer(1, 50), title: text(100), ...Object.fromEntries(['opening_hook', 'main_event', 'conflict', 'twist', 'cliffhanger'].map(key => [key, text(360)])) });
  const bibleFields = {
    title: text(100), genre: text(50), logline: text(300), target_audience: text(300), tone: text(300),
    world_setting: text(), core_conflict: text(), main_mystery: text(), selling_points: array(text(300), 3, 5),
    characters: array(character, 2, 6), props: array(prop, 0, 12), season_arc: array(arc, 5)
  };
  // DeepSeek structured output rejects any object whose `required` does not list every
  // property ("Required properties must match all properties in the object"), so every
  // schema sent to the model defaults to `required = Object.keys(properties)`.
  // An absent key-tool set is expressed as an empty array: array(prop, 0, 12) allows `[]`,
  // and validateBible/validateSeries still backfill `props: []` for V0.2 local history.
  const bibleSchema = object(bibleFields);
  const batchSchema = count => object({ episode_outlines: array(outline, count) });
  const seriesSchema = count => object({ ...bibleSchema.properties, episode_outlines: array(outline, count) });
  // Novel keeps its own episode shape (chapter text, no scenes/shots/duration); it does not
  // use `pacing`, so `pacing` exists only in the legacy V0.2 short-drama shape.
  const novelEpisode = { episode_number: integer(1, 50), title: text(100), opening_hook: text(500), twist: text(500), cliffhanger: text(500), continuity_summary: text(1500) };
  // V1 short-drama/comic production script: tighter fields plus scene->shot linkage and
  // structured dialogue, so each line of dialogue exists in exactly one place.
  const dialogueLine = object({ speaker: text(60), line: text(80) });
  const dramaEpisode = {
    episode_number: integer(1, 50), title: text(100), opening_hook: text(160),
    twist: text(240), cliffhanger: text(240), continuity_summary: text(800),
    scenes: array(object({ scene_number: integer(1, 6), location: text(120), time: text(60), characters: array(text(100), 1, 6),
      purpose: text(120), duration: { type: 'number', minimum: 3, maximum: 90 }, dialogue: array(dialogueLine, 0, 8) }), 1, 6),
    shot_list: array(object({ shot_number: integer(1, 20), scene_number: integer(1, 6), shot_type: text(40),
      visual: text(300), action: text(120), dialogue_line: integer(0, 8), duration: { type: 'number', minimum: 1.5, maximum: 12 },
      image_prompt: text(400), video_prompt: text(400) }), 3, 20)
  };
  const episodeSchema = type => type === 'novel'
    ? object({ ...novelEpisode, chapter_text: text(12000, 300) })
    : object(dramaEpisode);
  function check(value, schema, path = '结果') {
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractError('type_mismatch', `${path}必须为对象`);
      if (Object.keys(value).some(key => !Object.hasOwn(schema.properties, key))) throw new ContractError('unexpected_field', `${path}字段不完整或含多余字段`);
      if (schema.required.some(key => !Object.hasOwn(value, key))) throw new ContractError('missing_field', `${path}字段不完整或含多余字段`);
      for (const key of schema.required) check(value[key], schema.properties[key], `${path}.${key}`);
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) throw new ContractError('type_mismatch', `${path}数量不符合要求`);
      if (value.length < schema.minItems) throw new ContractError('array_too_short', `${path}数量不符合要求`);
      if (value.length > schema.maxItems) throw new ContractError('array_too_long', `${path}数量不符合要求`);
      value.forEach((item, i) => check(item, schema.items, `${path}[${i + 1}]`));
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') throw new ContractError('type_mismatch', `${path}文本为空或长度不符`);
      if (value.trim().length < schema.minLength) throw new ContractError('text_too_short', `${path}文本为空或长度不符`);
      if (value.length > schema.maxLength) throw new ContractError('text_too_long', `${path}文本为空或长度不符`);
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new ContractError('type_mismatch', `${path}数字不符合要求`);
      if (schema.type === 'integer' && !Number.isInteger(value)) throw new ContractError('number_not_integer', `${path}数字不符合要求`);
      if (value < schema.minimum || value > schema.maximum) throw new ContractError('number_out_of_range', `${path}数字不符合要求`);
    }
    return value;
  }
  function params(input) {
    if (!input || typeof input.idea !== 'string' || !input.idea.trim() || input.idea.trim().length > 500) throw new ContractError('invalid_idea', '请输入 1–500 字创意，并选择有效类型、题材与总集数。');
    if (!types.includes(input.type)) throw new ContractError('invalid_type', '请输入 1–500 字创意，并选择有效类型、题材与总集数。');
    if (!genres.includes(input.genre)) throw new ContractError('invalid_genre', '请输入 1–500 字创意，并选择有效类型、题材与总集数。');
    if (![20, 30, 50].includes(input.total_episodes)) throw new ContractError('invalid_total_episodes', '请输入 1–500 字创意，并选择有效类型、题材与总集数。');
    if (input.type !== 'novel' && ![30, 60, 90].includes(input.duration)) throw new ContractError('invalid_duration', '单集目标时长必须为 30、60 或 90 秒。');
    return { idea: input.idea.trim(), type: input.type, genre: input.genre, total_episodes: input.total_episodes, duration: input.type === 'novel' ? null : input.duration };
  }
  function validateBible(data, options) {
    if (!Object.hasOwn(data || {}, 'props')) data.props = [];
    check(data, bibleSchema);
    if (data.genre !== options.genre) throw new ContractError('genre_mismatch', '返回题材与所选题材不一致');
    let next = 1;
    for (const stage of data.season_arc) {
      if (stage.start_episode !== next || stage.end_episode < next) throw new ContractError('season_arc_overlap', '故事阶段集数有遗漏或重叠');
      next = stage.end_episode + 1;
    }
    if (next !== options.total_episodes + 1) throw new ContractError('season_arc_incomplete', '故事阶段未覆盖整季');
    if (new Set(data.characters.map(c => c.name.trim())).size !== data.characters.length) throw new ContractError('duplicate_character_name', '人物姓名重复');
    return data;
  }
  function validateSeries(data, options) {
    if (!Object.hasOwn(data || {}, 'props')) data.props = [];
    check(data, seriesSchema(options.total_episodes));
    const { episode_outlines, ...bible } = data;
    validateBible(bible, options);
    if (episode_outlines.some((item, i) => item.episode_number !== i + 1)) throw new ContractError('outline_numbering', '集数必须完整、连续且不重复');
    if (new Set(episode_outlines.map(item => item.main_event.trim())).size !== options.total_episodes) throw new ContractError('duplicate_outline_event', '每集事件不能完全重复');
    return data;
  }
  function validateEpisode(data, options, number, bible) {
    check(data, episodeSchema(options.type));
    if (data.episode_number !== number) throw new ContractError('episode_number_mismatch', '返回单集编号不一致');
    if (options.type !== 'novel') {
      const scenes = data.scenes;
      const sceneNumbers = new Set(scenes.map(scene => scene.scene_number));
      if (sceneNumbers.size !== scenes.length) throw new ContractError('duplicate_scene_number', '场景编号必须唯一');
      if (data.shot_list.some((shot, i) => shot.shot_number !== i + 1)) throw new ContractError('shot_numbering', '镜头编号必须连续');
      // Tolerance stays loose on purpose: duration rounding must not discard a valid generation.
      const tolerance = Math.max(1, options.duration * 0.05);
      if (Math.abs(data.shot_list.reduce((sum, shot) => sum + shot.duration, 0) - options.duration) > tolerance) throw new ContractError('shot_duration_total', '镜头总时长与目标时长不符');
      for (const shot of data.shot_list) {
        if (!sceneNumbers.has(shot.scene_number)) throw new ContractError('shot_scene_reference', '镜头引用了不存在的场景');
        if (shot.dialogue_line !== 0) {
          const scene = scenes.find(item => item.scene_number === shot.scene_number);
          if (shot.dialogue_line > scene.dialogue.length) throw new ContractError('dialogue_line_reference', '镜头引用的对白句不存在');
        }
      }
      if (data.shot_list.some(shot => /[\u3400-\u9fff]/u.test(shot.image_prompt + shot.video_prompt))) throw new ContractError('prompt_not_english', '绘图与视频提示词必须为英文');
      if (bible) {
        const known = new Set(bible.characters.map(character => character.name));
        if (scenes.some(scene => scene.characters.some(name => !known.has(name)))) throw new ContractError('unknown_scene_character', '场景人物不在人物 Bible 中');
        if (scenes.some(scene => scene.dialogue.some(item => !known.has(item.speaker)))) throw new ContractError('unknown_dialogue_speaker', '对白人物不在人物 Bible 中');
      }
    }
    return data;
  }
  // Backfills `props` for V0.2/V0.3 history and accepts older episode shapes by
  // re-parenting legacy fields into the V1 structure. Purely additive: it can only
  // delete legacy-only fields (voiceover/pacing/scene action) or relabel them.
  function dialogueLinesFrom(legacyText, characters, bible) {
    if (typeof legacyText !== 'string' || !legacyText.trim()) return [];
    const text = legacyText.replace(/\n?无对白\n?/g, '\n');
    const known = new Set((bible?.characters || []).map(character => character.name));
    const names = [...(bible?.characters || []).map(character => character.name), ...(characters || [])]
      .filter((name, index, list) => name && list.indexOf(name) === index)
      .sort((a, b) => b.length - a.length);
    const lines = [];
    for (const segment of text.split('\n')) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const quoted = [...trimmed.matchAll(/[“"]([^”"]+)[”"]/g)];
      if (quoted.length) {
        const before = trimmed.slice(0, quoted[0].index);
        const speaker = names.find(name => before.includes(name)) || (characters || [])[0] || (bible?.characters || [])[0]?.name;
        if (!speaker) continue;
        for (const match of quoted) lines.push({ speaker, line: match[1].trim().slice(0, 80) });
        continue;
      }
      const speaker = names.find(name => trimmed.startsWith(name)) || (characters || [])[0] || (bible?.characters || [])[0]?.name;
      if (speaker) lines.push({ speaker, line: trimmed.replace(/^[^：:]{1,60}[：:]\s*/, '').slice(0, 80) });
    }
    return lines.slice(0, 8);
  }
  // The model supplies pacing, while timeline math stays local and reproducible. Work
  // in deciseconds: that removes floating point tail drift and preserves 1.5–12s bounds.
  function normalizeShotDurations(shots, targetDuration) {
    const unit = 10, minimum = 15, maximum = 120;
    const target = Math.round(targetDuration * unit);
    if (!Array.isArray(shots) || !shots.length || !Number.isSafeInteger(target)
      || target < shots.length * minimum || target > shots.length * maximum) {
      throw new ContractError('shot_duration_unachievable', '镜头数量无法在单镜头时长限制内满足目标时长');
    }
    const values = shots.map(shot => Math.max(minimum, Math.min(maximum, Math.round(Number(shot?.duration) * unit))));
    let difference = target - values.reduce((sum, value) => sum + value, 0);
    // Give/take one decisecond at a time using the original durations as weights.
    // The lowest adjusted-to-requested ratio wins, which preserves relative pacing.
    const weights = shots.map(shot => Math.max(1, Math.round(Number(shot?.duration) * unit)));
    const adjusted = Array(shots.length).fill(0);
    while (difference !== 0) {
      const direction = Math.sign(difference);
      const candidates = values.map((value, index) => ({ value, index }))
        .filter(({ value }) => direction > 0 ? value < maximum : value > minimum);
      if (!candidates.length) throw new ContractError('shot_duration_unachievable', '镜头数量无法在单镜头时长限制内满足目标时长');
      candidates.sort((a, b) => (adjusted[a.index] / weights[a.index]) - (adjusted[b.index] / weights[b.index]) || a.index - b.index);
      const index = candidates[0].index;
      values[index] += direction;
      adjusted[index] += 1;
      difference -= direction;
    }
    return shots.map((shot, index) => ({ ...shot, duration: values[index] / unit }));
  }
  function normalizeEpisode(episode, options, bible) {
    if (!episode || typeof episode !== 'object' || options.type === 'novel') return episode;
    const normalized = { ...episode };
    // Legacy-only fields have no V1 equivalent; dropping them is the documented lossy step.
    delete normalized.pacing;
    delete normalized.voiceover;
    const known = new Set((bible?.characters || []).map(character => character.name));
    const safeSpeaker = name => (typeof name === 'string' && known.has(name) ? name : (bible?.characters || [])[0]?.name || String(name || ''));
    const scenes = (Array.isArray(episode.scenes) ? episode.scenes : []).map((scene, index) => {
      const sceneNumber = Number.isInteger(scene?.scene_number) ? scene.scene_number : index + 1;
      const characters = Array.isArray(scene?.characters) ? scene.characters : [];
      const dialogue = Array.isArray(scene?.dialogue)
        ? scene.dialogue.slice(0, 8).map(item => ({ speaker: safeSpeaker(item?.speaker), line: String(item?.line ?? '').slice(0, 80) })).filter(item => item.line)
        : dialogueLinesFrom(scene?.dialogue, characters, bible).map(item => ({ speaker: safeSpeaker(item.speaker), line: item.line }));
      const duration = Number.isFinite(scene?.duration) ? scene.duration : null;
      const purpose = typeof scene?.purpose === 'string' && scene.purpose.trim() ? scene.purpose.slice(0, 120)
        : (typeof scene?.action === 'string' ? scene.action.slice(0, 120) : `第${sceneNumber}场`);
      // Legacy `action` was the scene's only content; it becomes `purpose`, so no information is lost.
      return { scene_number: sceneNumber, location: String(scene?.location ?? '').slice(0, 120), time: String(scene?.time ?? '').slice(0, 60),
        characters: characters.slice(0, 6), purpose, duration, dialogue };
    });
    if (!scenes.length) return { ...normalized, scenes: [] };
    const rawShots = Array.isArray(episode.shot_list) ? episode.shot_list : [];
    const mappedShots = rawShots.map((shot, index) => {
      const sceneNumber = Number.isInteger(shot?.scene_number) && scenes.some(scene => scene.scene_number === shot.scene_number)
        ? shot.scene_number : scenes[0].scene_number;
      const dialogueLine = Number.isInteger(shot?.dialogue_line) ? shot.dialogue_line : 0;
      const scene = scenes.find(item => item.scene_number === sceneNumber);
      return { shot_number: Number.isInteger(shot?.shot_number) ? shot.shot_number : index + 1, scene_number: sceneNumber,
        shot_type: String(shot?.shot_type ?? '').slice(0, 40), visual: String(shot?.visual ?? '').slice(0, 300),
        action: String(shot?.action ?? '').slice(0, 120),
        dialogue_line: dialogueLine > 0 && dialogueLine <= scene.dialogue.length ? dialogueLine : 0,
        duration: Number.isFinite(shot?.duration) ? shot.duration : 3,
        image_prompt: String(shot?.image_prompt ?? '').slice(0, 400), video_prompt: String(shot?.video_prompt ?? '').slice(0, 400) };
    });
    normalized.shot_list = normalizeShotDurations(mappedShots, options.duration);
    const shotsByScene = new Map();
    for (const shot of normalized.shot_list) shotsByScene.set(shot.scene_number, (shotsByScene.get(shot.scene_number) || 0) + shot.duration);
    // `scenes[].duration` is derived data, never an independent model estimate.
    for (const scene of scenes) scene.duration = Math.round((shotsByScene.get(scene.scene_number) || 0) * 10) / 10;
    normalized.scenes = scenes;
    return normalized;
  }
  return { genres, types, bibleSchema, batchSchema, seriesSchema, episodeSchema, check, params, validateBible, validateSeries, validateEpisode, normalizeShotDurations, normalizeEpisode, ContractError };
});
