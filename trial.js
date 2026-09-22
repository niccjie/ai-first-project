'use strict';
const form = document.querySelector('#trial-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const body = [
    'AI Story Studio 免费试用申请',
    '',
    `称呼：${data.get('name')}`,
    `联系方式：${data.get('contact')}`,
    `想做的内容：${data.get('format')}`,
    '',
    '故事想法：',
    data.get('idea'),
    '',
    '最想解决的问题：',
    data.get('goal'),
    '',
    '我知道：这是免费试用申请，提交后由创作者确认交付范围。'
  ].join('\n');
  const subject = encodeURIComponent('AI Story Studio 免费试用申请');
  window.location.href = `mailto:niccjie@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`;
});
