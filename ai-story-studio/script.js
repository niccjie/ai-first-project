'use strict';

// Local templates only. No network requests or API credentials are used.
const formats = {
  drama: { label: '短剧', structure: '短剧 · 三场戏，约 2 分钟', visual: '电影感短剧剧照，写实人物，中近景构图，冷暖对比光，细腻表情，16:9 横幅' },
  comic: { label: '漫画', structure: '漫画 · 第一话，六格分镜', visual: '叙事漫画关键画面，清晰线稿，赛璐璐上色，夸张但自然的表情，动态构图，竖版 3:4' },
  novel: { label: '小说', structure: '小说 · 第一章开篇，叙事草稿', visual: '小说封面概念插画，富有层次的环境，柔和笔触，悬念氛围，上方保留标题空间但不生成文字，竖版 2:3' }
};

function buildStory(idea, type) {
  const format = formats[type];
  if (!format) throw new Error('请选择有效的创作类型。');
  const premise = idea.trim();
  if (!premise || premise.length > 500) throw new Error('请输入 1 至 500 字的故事想法。');
  const seed = Array.from(premise).slice(0, 36).join('') + (Array.from(premise).length > 36 ? '…' : '');
  const scripts = {
    drama: `第一集：《意外的开端》\n\n【第一场 · 傍晚 · 工作台】\n镜头慢慢靠近，林然将一张写着「${seed}」的纸放在桌上。\n林然（低声）：如果这不是一个巧合呢？\n手机响起。许知发来消息：「别急着下结论，先找证据。」\n\n【第二场 · 夜 · 走廊】\n许知赶来，把两张记录并排放下。其中一个细节完全相同。\n许知：你写下这个之前，有没有告诉过别人？\n林然摇头。走廊尽头突然传来敲门声。\n\n【第三场 · 夜 · 门口】\n林然打开门，地上只有一封署名「周序」的信。\n信上写着：「你已经开始了。明天，请做出不同的选择。」\n林然抬头。镜头切黑。`,
    comic: `第一话：《纸上的线索》\n\n第 1 格｜远景：傍晚的创作室，林然独自坐在窗边。旁白：「一切，从一个想法开始。」\n第 2 格｜特写：纸上写着「${seed}」。一角出现陌生的红色标记。\n第 3 格｜中景：林然举起纸，眉头紧锁。对白：「这不是我画的。」\n第 4 格｜双人构图：许知拿出自己的记录，同样的标记出现在页边。对白：「我们得查清楚。」\n第 5 格｜俯视特写：两张纸拼在一起，背面的线条组成一扇门。用速度线强调惊讶。\n第 6 格｜整页悬念：门外站着模糊的人影。手机显示周序的消息：「不要开门。」`,
    novel: `第一章：《未写完的答案》\n\n林然把「${seed}」写在纸上时，窗外最后一点天光正在消失。那原本只是一个尚未成形的故事想法，可纸张背面透出的另一行字，让手中的笔停了下来。\n\n「你确定，这是第一次想到它吗？」\n\n林然翻过纸，背面却空空如也。走廊里的灯亮了一下，又熄灭了。林然想给这个异常找一个合理解释，却发现自己的第一反应不是害怕，而是某种久违的熟悉。\n\n许知推门进来，把一本旧记录放在桌上。「先别猜。」她说，「我们把确定的事情列出来。」记录最后一页有同样的句子，日期却早了整整一年。\n\n那一刻，林然意识到，真正需要回答的也许不是事情如何发生，而是谁希望自己再次发现它。手机轻轻震动，周序发来一条消息：明天见。别带那张纸。`
  };
  return {
    type: format.label,
    idea: premise,
    summary: `以「${premise}」为创作起点，这部${format.label}采用悬念叙事展开：主角林然发现一个与设想呼应的异常线索，和伙伴许知一起核实真相。随着知情人周序出现，原本简单的探索变成了一次关于信任与选择的考验。故事从一个具体的小事件切入，逐步揭示选择的代价。`,
    characters: [
      '林然｜主角：善于观察、行动谨慎。希望查清异常的来源，却担心真相改变现有生活；成长方向是从等待答案到主动做出选择。',
      '许知｜伙伴：理性直接，习惯用记录和证据解决问题。愿意帮助林然，但不会无条件认同；两人的分歧推动调查前进。',
      '周序｜关键人物：掌握部分线索，表达克制。试图阻止同一个错误再次发生，却隐瞒了自己曾经的选择。'
    ],
    outline: [
      `起点：围绕「${seed}」，用一个反常细节建立悬念，让主角不得不采取行动。`,
      '推进：林然与许知交叉核实线索，发现事件并非偶然；周序提出一个附带条件的帮助。',
      '转折：一条看似可靠的证据被推翻，伙伴间产生分歧，主角必须承担自己的判断。',
      '收束：主角主动面对选择，解决眼前的问题；留下一个新的线索，为后续故事建立空间。'
    ],
    scriptFormat: format.structure,
    script: scripts[type],
    prompt: `故事主题：${premise}。画面主体：林然站在窗边的工作台前，手持一张带有神秘标记的纸，许知在身后观察；窗外暮色与室内台灯形成对比。${format.visual}。保持角色形象一致，突出纸张与人物情绪，背景简洁，无水印，无可读文字。`
  };
}

function formatStoryText(story) {
  return `AI Creator Studio · ${story.type}创作方案\n想法：${story.idea}\n\n故事简介\n${story.summary}\n\n人物设定\n${story.characters.join('\n')}\n\n剧情大纲\n${story.outline.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n第一集脚本（${story.scriptFormat}）\n${story.script}\n\nAI绘图提示词\n${story.prompt}\n\n本地模板模拟生成，未接入 AI API。`;
}

const form = document.querySelector('#creator-form');
const input = document.querySelector('#story-idea');
const generateButton = document.querySelector('#generate-button');
const generateLabel = document.querySelector('#generate-label');
const exampleButton = document.querySelector('#example-button');
const error = document.querySelector('#idea-error');
const status = document.querySelector('#generation-status');
const badge = document.querySelector('#result-badge');
const output = document.querySelector('#output-panel');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#empty-state');
const loadingState = document.querySelector('#loading-state');
const copyButton = document.querySelector('#copy-button');
const copyStatus = document.querySelector('#copy-status');
let isGenerating = false;
let currentStory = null;

function updateCount() {
  document.querySelector('#character-count').textContent = `${input.value.length} / 500`;
  input.removeAttribute('aria-invalid');
  error.textContent = '';
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  list.replaceChildren(...items.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
}

function renderStory(story) {
  // Use textContent throughout: user input is never interpreted as HTML.
  document.querySelector('#result-source').textContent = `你的想法：${story.idea}`;
  document.querySelector('#story-summary').textContent = story.summary;
  renderList('#story-characters', story.characters);
  renderList('#story-outline', story.outline);
  document.querySelector('#script-format').textContent = story.scriptFormat;
  document.querySelector('#story-script').textContent = story.script;
  document.querySelector('#image-prompt').textContent = story.prompt;
}

function setBusy(busy) {
  isGenerating = busy;
  generateButton.disabled = busy;
  exampleButton.disabled = busy;
  input.disabled = busy;
  form.querySelectorAll('input[type="radio"]').forEach(radio => { radio.disabled = busy; });
  document.querySelector('#spinner').hidden = !busy;
  output.setAttribute('aria-busy', String(busy));
  loadingState.hidden = !busy;
  generateLabel.textContent = busy ? '正在生成创作方案…' : '生成创作方案';
}

input.addEventListener('input', updateCount);
exampleButton.addEventListener('click', () => {
  input.value = '一个大学生发现，自己的笔记本能收到来自未来的留言；每改变一个选择，留言就会发生变化。';
  updateCount();
  input.focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (isGenerating) return;
  const idea = input.value.trim();
  if (!idea || idea.length > 500) {
    error.textContent = idea ? '请将故事想法控制在 500 字以内。' : '先写下一个故事想法，再开始生成。';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }
  const type = form.querySelector('input[name="story-type"]:checked').value;
  error.textContent = '';
  input.removeAttribute('aria-invalid');
  copyStatus.textContent = '';
  results.hidden = true;
  emptyState.hidden = true;
  setBusy(true);
  badge.textContent = '模拟生成中';
  status.textContent = '正在整理灵感、设定人物并展开故事…';
  try {
    await new Promise(resolve => setTimeout(resolve, 1600));
    const story = buildStory(idea, type);
    renderStory(story);
    currentStory = story;
    results.hidden = false;
    badge.textContent = `${story.type} · 模拟方案`;
    status.textContent = '五个部分已准备好。你可以继续修改想法，或复制完整方案。';
  } catch (failure) {
    results.hidden = !currentStory;
    emptyState.hidden = Boolean(currentStory);
    badge.textContent = currentStory ? `${currentStory.type} · 上次方案` : '等待重试';
    status.textContent = '本次生成未完成，请重试。';
  } finally {
    setBusy(false);
  }
  if (!results.hidden) document.querySelector('#output-title').focus();
});

copyButton.addEventListener('click', async () => {
  if (!currentStory || isGenerating) return;
  const text = formatStoryText(currentStory);
  copyStatus.textContent = '';
  copyButton.disabled = true;
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = '完整方案已复制。';
  } catch (failure) {
    // Local file previews may not permit Clipboard API access.
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(results);
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatus.textContent = '已选中方案，请使用系统复制操作（电脑按 Ctrl/Cmd+C）。';
  } finally {
    copyButton.disabled = false;
  }
});
