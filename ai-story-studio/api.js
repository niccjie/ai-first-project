'use strict';

// Public URL only. API keys belong exclusively in backend environment variables.
window.StudioAPI = (() => {
  const config = Object.freeze({ endpoint: '/api/create-story', timeoutMs: 60000 });
  const fields = ['title', 'summary', 'characters', 'outline', 'episode', 'image_prompt'];
  const types = { drama: '短剧', comic: '漫画', novel: '小说' };
  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || fields.some(key => typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 20000) || Object.keys(data).some(key => !fields.includes(key))) throw new Error('生成结果格式不完整，请重新生成。');
    return Object.fromEntries(fields.map(key => [key, data[key].trim()]));
  }
  function demo(idea, type) {
    const variant = Math.floor(Math.random() * 3);
    const name = ['林然', '陈曦', '沈星'][variant];
    const title = ['下一次选择', '明日来信', '未完成的答案'][variant];
    const seed = Array.from(idea).slice(0, 40).join('');
    const episodes = {
      drama: `场景1：意外的提示\n地点：大学自习室，傍晚\n人物：${name}、许知\n动作：${name}在笔记本上写下「${seed}」，屏幕突然亮起。\n对白：\n${name}：“这是我的想法，为什么有人提前知道？”\n许知：“先别相信它，我们需要证据。”\n\n场景2：选择的代价\n地点：校园走廊，夜晚\n人物：${name}、周序\n动作：周序递来一份标注着明天日期的记录。\n对白：\n周序：“你可以改变结果，但不能替别人选择。”\n${name}：“如果我什么都不做呢？”\n周序：“那也是一种选择。”\n镜头：屏幕倒计时归零，走廊的灯突然熄灭。`,
      comic: `第一话：${title}\n\n分镜1｜远景：大学自习室，${name}在桌前构思「${seed}」。\n分镜2｜特写：笔记本上浮现陌生标记。\n分镜3｜中景：许知俯身查看。对白：“有人比我们更早知道。”\n分镜4｜俯视：两份记录上的日期相差一天。\n分镜5｜近景：周序递来信封。对白：“选择是有代价的。”\n分镜6｜整页：校园上空出现倒计时，${name}抬起头。旁白：“故事才刚刚开始。”`,
      novel: `第一章：${title}\n\n${name}在笔记本上写下「${seed}」的时候，还不知道这个想法会改变什么。窗外的暮色缓慢地落下来，屏幕却亮起一行字：你愿意为明天付出什么？\n\n“别急着回答。”许知把一份旧记录推过来。相同的问题，居然出现在昨天的纸页上。\n\n走廊外，周序已经等了很久。他手里的信封上写着一个日期——明天。\n\n“如果真能改变结果，”${name}问，“为什么你不自己做？”\n\n周序没有回答。灯光熄灭前，他只是把信封放在桌上。`
    };
    return validate({
      title: `《${title}》`,
      summary: `一句话介绍：围绕「${idea}」，19岁的${name}发现改变生活的机会，却必须承担每次选择的代价。\n\n故事背景：近未来的大学校园，智能系统逐渐参与日常决策。主角从一条异常消息开始调查，寻找技术背后真正的人与动机。此为${types[type]}模板示范，可继续改写设定。`,
      characters: `主角\n姓名：${name}\n年龄：19岁\n身份：大学生\n性格：好奇、谨慎，有时犹豫\n能力：发现信息之间的隐藏联系\n\n配角\n姓名：许知\n作用：理性的伙伴，核实证据并挑战主角判断\n\n配角\n姓名：周序\n作用：掌握线索的引路人，隐藏着曾经失败的选择`,
      outline: `第一幕：故事开始\n${name}围绕「${seed}」发现异常线索，与许知一起验证。\n\n第二幕：冲突出现\n系统的建议带来意外后果，伙伴之间产生分歧。周序的出现让主角发现自己并非唯一参与者。\n\n第三幕：高潮和结局\n主角拒绝盲从系统，主动承担选择的后果，与伙伴共同解决眼前危机。最后一条未知消息留下后续悬念。`,
      episode: episodes[type],
      image_prompt: `${['Cinematic anime style', 'Detailed graphic novel illustration', 'Atmospheric digital painting'][variant]}, a 19-year-old university student discovering a mysterious AI interface, futuristic university campus at dusk, a glowing notebook, expressive face, dramatic warm and cool lighting, intricate environment, consistent character design, ${type === 'drama' ? 'wide shot, 16:9 composition' : 'vertical composition, 3:4 aspect ratio'}, no text, no watermark`
    });
  }
  async function generate({ idea, type, mode }) {
    if (typeof idea !== 'string' || !idea.trim() || idea.trim().length > 500 || !Object.hasOwn(types, type)) throw new Error('请输入 1 至 500 字的想法，并选择创作类型。');
    if (mode === 'demo') {
      await new Promise(resolve => setTimeout(resolve, 1800));
      return demo(idea.trim(), type);
    }
    if (mode !== 'ai' || !config.endpoint) throw new Error('真实 AI 接口尚未配置，请先使用 Demo 模式。');
    const endpoint = new URL(config.endpoint, window.location.href);
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) throw new Error('AI 接口必须使用 HTTPS。');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: idea.trim(), type }), signal: controller.signal });
      if (!response.ok) {
        const messages = { 400: '输入无效，请修改故事想法。', 401: 'AI 服务验证失败，请检查服务端密钥。', 403: '当前站点无权访问 AI 服务。', 404: '未找到 AI 接口，请通过本地 Express 服务打开网页。', 422: 'AI 未能完成本次创作，请调整想法后重试。', 429: '请求过于频繁或 API 配额受限，请稍后重试。', 503: '请在 server/.env 配置密钥和模型并重启服务，或使用 Demo 模式。', 504: 'AI 请求超时，请稍后重试。' };
        throw new Error(messages[response.status] || 'API连接失败，请稍后重试。');
      }
      let data;
      try { data = await response.json(); } catch { throw new Error('AI 返回了无效 JSON，请稍后重试。'); }
      // The API returns five fields. Keep the existing outline panel and old six-field history.
      if (data && typeof data.summary === 'string' && !Object.hasOwn(data, 'outline')) {
        const split = data.summary.match(/(?:^|\n)剧情大纲[：:]\s*\n?/);
        const outline = split ? data.summary.slice(split.index + split[0].length).trim() : '本次方案未单列剧情大纲，可参考故事简介与首集脚本。';
        const summary = split ? data.summary.slice(0, split.index).trim() : data.summary;
        data = { ...data, summary, outline };
      }
      return validate(data);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('AI 请求超时，请稍后重试。');
      if (error instanceof TypeError) throw new Error('API连接失败，请检查网络后重试。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  return Object.freeze({ generate, validate, types, configured: Boolean(config.endpoint) });
})();
