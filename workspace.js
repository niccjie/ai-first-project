(() => {
  'use strict';
  const get = (id) => document.getElementById(id);
  const form = get('idea-form');
  const input = get('idea-input');
  const button = get('generate-button');
  const example = get('example-button');
  const copy = get('copy-button');
  const panel = get('result-panel');
  const status = get('generation-status');
  let busy = false;
  let planText = '';
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Local templates only. Replace this adapter with a backend request in v0.2.
  function createMockPlan(idea) {
    const topic = idea.replace(/\s+/g, ' ').trim();
    const shortTopic = Array.from(topic).slice(0, 36).join('') + (Array.from(topic).length > 36 ? '…' : '');
    const learning = /学习|学生|课程|study|learn/i.test(topic);
    const story = /故事|短剧|剧情|story|drama/i.test(topic);
    return {
      direction: learning ? '面向学习者的实践分享：用一个真实问题串联方法与结果。' : story ? '故事创作：围绕一个人物目标，设计冲突与转折。' : '主题经验分享：从一个具体问题切入，提供可执行的建议。',
      title: learning && /AI/i.test(topic) ? 'AI时代大学生如何学习' : `${shortTopic}：从想法到实践`,
      description: `围绕“${topic}”展开，${learning ? '介绍可尝试的学习方法，并通过具体案例说明如何提升效率。' : story ? '梳理人物动机、核心冲突与结局，形成可继续创作的故事草稿。' : '提炼核心观点、具体步骤与实践建议，帮助观众理解并行动。'}`,
      outline: [
        `01 开头：用“${shortTopic}”中的一个问题或场景吸引注意。`,
        story ? '02 核心内容：介绍主角目标，设置障碍，安排一次关键转折。' : '02 核心内容：拆解三个要点，每个要点配一个案例或演示。',
        '03 结尾：总结核心收获，提出一个可执行的小任务并邀请反馈。'
      ],
      publishing: `将“${shortTopic}”整理成一条 60–90 秒短视频或一篇图文；封面突出一个核心问题，正文保留关键步骤，发布后根据评论优化下一期选题。`,
      tags: learning ? ['AI', '学习', '效率'] : story ? ['AI创作', '故事', '短剧'] : ['内容创作', '灵感', '实践']
    };
  }

  function renderList(id, items) {
    get(id).replaceChildren(...items.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
  }

  function renderPlan(idea, plan) {
    // Never interpret user input as HTML.
    get('result-source').textContent = `本次想法：${idea}`;
    ['direction', 'title', 'description', 'publishing'].forEach((key) => {
      get(`result-${key}`).textContent = plan[key];
    });
    renderList('result-outline', plan.outline);
    renderList('result-tags', plan.tags);
    get('result-mode').textContent = '本地模拟结果';
    planText = `AI Creator Workspace · 本地模拟方案\n想法：${idea}\n\n内容方向：${plan.direction}\n标题：${plan.title}\n简介：${plan.description}\n\n${plan.outline.join('\n')}\n\n发布方案：${plan.publishing}\n标签：${plan.tags.join(' / ')}`;
    panel.classList.remove('result-ready');
    void panel.offsetWidth;
    panel.classList.add('result-ready');
  }

  input.addEventListener('input', () => {
    get('input-error').textContent = '';
    input.removeAttribute('aria-invalid');
  });
  example.addEventListener('click', () => {
    input.value = '做一期关于AI学习的视频';
    get('input-error').textContent = '';
    input.removeAttribute('aria-invalid');
    input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const idea = input.value.trim();
    if (!idea || idea.length > 300) {
      get('input-error').textContent = !idea ? '请先写下一个想法，再生成方案。' : '请将想法控制在 300 字以内。';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    busy = true;
    button.disabled = example.disabled = copy.disabled = true;
    input.readOnly = true;
    panel.setAttribute('aria-busy', 'true');
    button.querySelector('.loader').hidden = false;
    get('generate-label').textContent = '生成中';
    get('copy-status').textContent = '';
    try {
      status.textContent = '正在分析你的创意...（本地模拟）';
      await wait(650);
      status.textContent = '正在生成内容结构...（本地模拟）';
      await wait(850);
      renderPlan(idea, createMockPlan(idea));
      status.textContent = '完成。模拟方案已生成，可以复制或修改想法后重新生成。';
      get('result-heading').focus({ preventScroll: true });
      panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    } catch (error) {
      status.textContent = '生成未完成，请重新尝试。';
    } finally {
      busy = false;
      button.disabled = example.disabled = false;
      copy.disabled = !planText;
      input.readOnly = false;
      panel.setAttribute('aria-busy', 'false');
      button.querySelector('.loader').hidden = true;
      get('generate-label').textContent = planText ? '重新生成' : '生成方案';
    }
  });

  copy.addEventListener('click', async () => {
    if (!planText || busy) return;
    const snapshot = planText;
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(snapshot);
      get('copy-status').textContent = '方案已复制。';
    } catch (error) {
      get('copy-status').textContent = '无法自动复制，请选中结果文字手动复制。';
    } finally {
      copy.disabled = busy;
    }
  });
})();
