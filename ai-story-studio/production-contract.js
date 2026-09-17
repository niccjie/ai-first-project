'use strict';
// Shared, credential-free schemas and validation for the browser and server.
(function (root, factory) {
  const contract = factory();
  if (typeof module === 'object' && module.exports) module.exports = contract;
  else root.ProductionContract = contract;
})(typeof window === 'object' ? window : globalThis, () => {
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
  // `props` is optional for V0.2 local history; newly generated plans are instructed to include it.
  const bibleSchema = object(bibleFields, Object.keys(bibleFields).filter(key => key !== 'props'));
  const batchSchema = count => object({ episode_outlines: array(outline, count) });
  const seriesSchema = count => {
    const properties = { ...bibleSchema.properties, episode_outlines: array(outline, count) };
    return object(properties, Object.keys(properties).filter(key => key !== 'props'));
  };
  const commonEpisode = { episode_number: integer(1, 50), title: text(100), opening_hook: text(500), pacing: text(1500), twist: text(500), cliffhanger: text(500), continuity_summary: text(1500) };
  const episodeSchema = type => type === 'novel'
    ? object({ ...commonEpisode, chapter_text: text(12000, 300) })
    : object({ ...commonEpisode,
      scenes: array(object({ scene_number: integer(1, 8), location: text(200), time: text(100), characters: array(text(100), 1, 6), action: text(2000), dialogue: text(2000) }), 1, 8),
      voiceover: text(6000),
      shot_list: array(object({ shot_number: integer(1, 20), shot_type: text(100), visual: text(1000), action: text(1000), dialogue: text(1000), duration: { type: 'number', minimum: 0.5, maximum: 90 }, image_prompt: text(2000), video_prompt: text(2000) }), 3, 20)
    });
  function check(value, schema, path = '结果') {
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${path}必须为对象`);
      if (Object.keys(value).some(key => !Object.hasOwn(schema.properties, key)) || schema.required.some(key => !Object.hasOwn(value, key))) throw Error(`${path}字段不完整或含多余字段`);
      for (const key of schema.required) check(value[key], schema.properties[key], `${path}.${key}`);
    } else if (schema.type === 'array') {
      if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) throw Error(`${path}数量不符合要求`);
      value.forEach((item, i) => check(item, schema.items, `${path}[${i + 1}]`));
    } else if (schema.type === 'string') {
      if (typeof value !== 'string' || value.trim().length < schema.minLength || value.length > schema.maxLength) throw Error(`${path}文本为空或长度不符`);
    } else if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < schema.minimum || value > schema.maximum) throw Error(`${path}数字不符合要求`);
    return value;
  }
  function params(input) {
    if (!input || typeof input.idea !== 'string' || !input.idea.trim() || input.idea.trim().length > 500 || !types.includes(input.type) || !genres.includes(input.genre) || ![20, 30, 50].includes(input.total_episodes)) throw Error('请输入 1–500 字创意，并选择有效类型、题材与总集数。');
    if (input.type !== 'novel' && ![30, 60, 90].includes(input.duration)) throw Error('单集目标时长必须为 30、60 或 90 秒。');
    return { idea: input.idea.trim(), type: input.type, genre: input.genre, total_episodes: input.total_episodes, duration: input.type === 'novel' ? null : input.duration };
  }
  function validateBible(data, options) {
    if (!Object.hasOwn(data || {}, 'props')) data.props = [];
    check(data, bibleSchema);
    if (data.genre !== options.genre) throw Error('返回题材与所选题材不一致');
    let next = 1;
    for (const stage of data.season_arc) {
      if (stage.start_episode !== next || stage.end_episode < next) throw Error('故事阶段集数有遗漏或重叠');
      next = stage.end_episode + 1;
    }
    if (next !== options.total_episodes + 1) throw Error('故事阶段未覆盖整季');
    if (new Set(data.characters.map(c => c.name.trim())).size !== data.characters.length) throw Error('人物姓名重复');
    return data;
  }
  function validateSeries(data, options) {
    if (!Object.hasOwn(data || {}, 'props')) data.props = [];
    check(data, seriesSchema(options.total_episodes));
    const { episode_outlines, ...bible } = data;
    validateBible(bible, options);
    if (episode_outlines.some((item, i) => item.episode_number !== i + 1)) throw Error('集数必须完整、连续且不重复');
    if (new Set(episode_outlines.map(item => item.main_event.trim())).size !== options.total_episodes) throw Error('每集事件不能完全重复');
    return data;
  }
  function validateEpisode(data, options, number, bible) {
    check(data, episodeSchema(options.type));
    if (data.episode_number !== number) throw Error('返回单集编号不一致');
    if (options.type !== 'novel') {
      if (data.scenes.some((s, i) => s.scene_number !== i + 1) || data.shot_list.some((s, i) => s.shot_number !== i + 1)) throw Error('场景与镜头编号必须连续');
      if (Math.abs(data.shot_list.reduce((sum, shot) => sum + shot.duration, 0) - options.duration) > 1) throw Error('镜头总时长与目标时长不符');
      if (data.shot_list.some(shot => /[\u3400-\u9fff]/u.test(shot.image_prompt + shot.video_prompt))) throw Error('绘图与视频提示词必须为英文');
      if (bible && data.scenes.some(scene => scene.characters.some(name => !bible.characters.some(c => c.name === name)))) throw Error('场景人物不在人物 Bible 中');
    }
    return data;
  }
  return { genres, types, bibleSchema, batchSchema, seriesSchema, episodeSchema, check, params, validateBible, validateSeries, validateEpisode };
});
