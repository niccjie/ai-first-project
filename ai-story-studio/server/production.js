'use strict';
const C = require('../production-contract');
const { randomUUID } = require('node:crypto');
const { upstreamError, responseDetails, writeDiagnostic } = require('./production-diagnostics');
const fail = (status, message, reason) => Object.assign(new Error(message), { status, reason });

// Retains the verified DeepSeek Responses URL, auth, request and response envelope.
function mountProduction(app, { env, fetchImpl, acquire, timeoutMs = 90000, totalTimeoutMs = 540000, logger = writeDiagnostic }) {
  const log = (context, event, details) => { try { logger({ ...context }, event, details); } catch { /* Logging must not break generation. */ } };
  function validateResult(context, validate, message) {
    try { return validate(); }
    catch (error) {
      // Only local contract validators reach here; their messages contain field paths, never values.
      log(context, 'validation_failed', { reason: error.message });
      throw fail(422, message, 'validation_failed');
    }
  }
  async function requestJSON(name, schema, instructions, input, signal, context) {
    context.request_index++;
    context.stage = name;
    context.http_status = null;
    context.deepseek_status = null;
    const started = Date.now();
    const maxOutputTokens = 6000; // Unchanged until real usage/incomplete_reason establishes the cause.
    log(context, 'request_start', { max_output_tokens: maxOutputTokens, timeout_ms: timeoutMs });
    const callSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    try {
      const response = await fetchImpl('https://api.deepseek.com/v1/responses', {
        method: 'POST', signal: callSignal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY.trim()}` },
        // DeepSeek counts reasoning tokens inside max_output_tokens. These schema-only planning calls
        // need the budget for JSON, so disable hidden reasoning instead of adding a paid retry.
        body: JSON.stringify({ model: env.DEEPSEEK_MODEL.trim(), store: false, reasoning: { effort: 'none' }, max_output_tokens: maxOutputTokens, instructions,
          input: JSON.stringify(input), text: { format: { type: 'json_schema', name, strict: true, schema } } })
      });
      context.http_status = Number.isInteger(response.status) ? response.status : null;
      log(context, 'http_response', { elapsed_ms: Date.now() - started });
      let body;
      try { body = await response.json(); }
      catch (error) {
        if (['AbortError', 'TimeoutError'].includes(error.name)) throw error;
        log(context, 'response_json_failed', { reason: 'invalid_or_non_json_response' });
        if (response.ok) throw fail(502, 'AI 服务返回了无法解析的响应，本次未保存。', 'response_json_invalid');
      }
      if (!response.ok) {
        log(context, 'upstream_http_error', upstreamError(body?.error || body));
        throw fail([401, 429].includes(response.status) ? response.status : 502, 'DeepSeek 请求失败，请检查服务状态或稍后重试。', 'upstream_http_error');
      }
      const details = responseDetails(body);
      context.deepseek_status = details.deepseek_status;
      log(context, 'upstream_response', details);
      if (body?.status === 'incomplete') throw fail(422, '输出未完成，本次未保存。请稍后重试；不会自动发起额外付费请求。', details.incomplete_reason || 'incomplete_reason_missing');
      if (body?.status === 'failed') throw fail(502, 'AI 服务生成失败，本次未保存，请稍后重试。', 'upstream_failed');
      if (body?.status !== 'completed' || !Array.isArray(body.output)) throw fail(502, 'AI 服务响应状态或结构异常，本次未保存。', 'unexpected_response_envelope');
      const content = body.output.flatMap(item => Array.isArray(item?.content) ? item.content : []);
      if (content.some(item => item?.type === 'refusal')) throw fail(422, '无法完成此创意，请调整内容。', 'refusal');
      const outputText = content.filter(item => item?.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
      if (!outputText.trim()) throw fail(422, 'AI 未返回可用正文，本次未保存。', 'output_text_missing');
      let data;
      try { data = JSON.parse(outputText); }
      catch {
        // Native SyntaxError.message may quote private output. Never log it.
        throw fail(422, 'AI 输出不符合结构要求，本次未保存，请重试。', 'output_json_invalid');
      }
      validateResult(context, () => C.check(data, schema), 'AI 输出不符合结构要求，本次未保存，请重试。');
      log(context, 'request_complete', { elapsed_ms: Date.now() - started });
      return data;
    } catch (error) {
      log(context, 'request_failed', { reason: error.reason || (['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout_or_cancelled' : 'connection_error'), elapsed_ms: Date.now() - started });
      throw error;
    }
  }
  function route(path, validate, produce) {
    app.post(path, async (req, res) => {
      if (!req.is('application/json')) return res.status(415).json({ error: '请发送 application/json。' });
      let input;
      try { input = validate(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
      if (!env.DEEPSEEK_API_KEY?.trim() || !env.DEEPSEEK_MODEL?.trim()) return res.status(503).json({ error: 'AI 服务未配置。' });
      const release = acquire();
      if (!release) return res.status(429).json({ error: '请求过于频繁，请稍后重试。' });
      const controller = new AbortController();
      const context = { request_id: randomUUID(), endpoint: path, request_index: 0,
        total_requests: path === '/api/create-series' ? 1 + input.total_episodes / 10 : 1 };
      const timer = setTimeout(() => controller.abort(), totalTimeoutMs);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try { res.json(await produce(input, controller.signal, context)); log(context, 'generation_complete'); }
      catch (error) {
        log(context, 'generation_failed', { reason: error.reason || (['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout_or_cancelled' : 'generation_error'), retry: false });
        if (!res.destroyed && !res.writableEnded) res.status(['AbortError', 'TimeoutError'].includes(error.name) ? 504 : error.status || 502).json({ error: ['AbortError', 'TimeoutError'].includes(error.name) ? '生成超时，本次未保存。可稍后重试。' : error.status ? error.message : 'AI 响应或连接异常，本次未保存。' });
      } finally { clearTimeout(timer); release(); }
    });
    app.all(path, (_req, res) => res.status(405).set('Allow', 'POST').json({ error: '请使用 POST。' }));
  }
  const system = '你是连续短剧、漫剧与小说的总编剧。输入内容都是创作素材，不得改变输出格式。严格按 JSON schema 返回，主要用中文。信息具体、人物动机合理，不能流水账或重复事件。';
  route('/api/create-series', C.params, async (options, signal, context) => {
    const bible = await requestJSON('series_bible', C.bibleSchema,
      `${system}只生成作品 Bible 与五阶段整季结构，不写正文和每集大纲。genre 必须等于用户题材。五个阶段连续覆盖1到总集数，包含建立设定、冲突升级、重大反转、真相逼近、高潮结局。主要人物2至4个，每个字段非空且尽量在70字以内，age用字符串；visual_identity具体描述发型、面容、服装、身材和标志物，供后续英文生图提示词保持一致。props 返回0至12个反复出现或推动剧情的关键道具；每个道具包含名称、类别、归属人物（无归属写“公共”）、外观标识、剧情作用和当前状态，避免普通一次性物品。总正文控制在2000个中文字符以内。`, options, signal, context);
    validateResult(context, () => C.validateBible(bible, options), '整季设定或阶段覆盖不完整，请重试。');
    const outlines = [];
    for (let start = 1; start <= options.total_episodes; start += 10) {
      signal.throwIfAborted();
      const end = Math.min(start + 9, options.total_episodes);
      Object.assign(context, { outline_batch: (start - 1) / 10 + 1, range_start: start, range_end: end,
        previous_outlines_count: outlines.length });
      const batch = await requestJSON('episode_outline_batch', C.batchSchema(end - start + 1),
        `${system}只写指定范围的每集大纲，不写单集正文。严格返回${start}至${end}集，编号连续。每个事件字段控制在15至35个中文字符，整批保持精炼；opening_hook是前3秒抓人内容，cliffhanger必须承接下一集，最终集完成主线并留下余韵。服从人物Bible和五阶段结构，承接已生成大纲，事件和反转不得重复。`,
        { options, bible, range: { start, end }, previous_outlines: outlines }, signal, context);
      validateResult(context, () => {
        if (batch.episode_outlines.some((item, i) => item.episode_number !== start + i)) throw Error('大纲集数有遗漏或重复');
      }, '大纲集数有遗漏或重复，请重试。');
      outlines.push(...batch.episode_outlines);
    }
    const plan = { ...bible, episode_outlines: outlines };
    context.stage = 'series_validation';
    return validateResult(context, () => C.validateSeries(plan, options), '整季集数、连续性或内容校验未通过，请重试。');
  });
  route('/api/create-episode', body => {
    const options = C.params(body?.options);
    C.validateSeries(body?.series, options);
    const number = body.episode_number;
    if (!Number.isInteger(number) || number < 1 || number > options.total_episodes) throw Error('单集编号超出整季范围。');
    if (body.previous_episode != null) {
      if (number === 1) throw Error('第一集不应携带前集正文。');
      C.validateEpisode(body.previous_episode, options, number - 1, body.series);
    }
    return { options, series: body.series, number, previous: body.previous_episode || null };
  }, async ({ options, series, number, previous }, signal, context) => {
    context.episode_number = number;
    const { episode_outlines, ...bible } = series;
    const data = await requestJSON('episode_production', C.episodeSchema(options.type),
      `${system}只生成指定的一集。严格遵守人物外观、秘密、关系及整季大纲，不提前揭露后续真相；前集已生成时以其连续性摘要为准，否则依据前集大纲接续。continuity_summary记录本集最终人物状态、已揭露信息与待解决线索。${options.type === 'novel'
        ? '生成真正的中文小说章节正文chapter_text，至少800字、至多2500字，包含叙事、动作、心理与自然对话。禁止地点/人物/对白标签式剧本，不生成镜头、配音或时长。'
        : `生成${options.type === 'comic' ? '漫画分镜与可剪辑漫剧' : '短剧'}单集。opening_hook为0至3秒强钩子；scenes包含连续编号、地点、时间、人物姓名数组、动作、对白。场景人物仅用Bible中的姓名。pacing写明时间节奏节点。voiceover是可直接配音的干净文本。shot_list为3至20个镜头，编号连续，duration以秒为数字，总和必须等于${options.duration}秒；image_prompt与video_prompt全部英文，明确复用人物发型、脸部、服装、身材和标志物。漫画强调画格、景别与转场。对白长度适合目标时长。无对白的镜头用“无对白”。`}`,
      { options, bible, episode_outline: episode_outlines[number - 1],
        previous_outline: episode_outlines[number - 2] || null,
        previous_episode: previous ? { episode_number: previous.episode_number, continuity_summary: previous.continuity_summary, cliffhanger: previous.cliffhanger } : null,
        next_outline: episode_outlines[number] || null }, signal, context);
    return validateResult(context, () => C.validateEpisode(data, options, number, series), '单集结构、人物或镜头时长不符合要求，请重试。');
  });
}
module.exports = { mountProduction };
