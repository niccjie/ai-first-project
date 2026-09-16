const exploreButton = document.querySelector('#explore-button');
const buttonMessage = document.querySelector('#button-message');

exploreButton.addEventListener('click', () => {
  document.body.classList.add('explored');
  exploreButton.classList.add('is-clicked');
  buttonMessage.textContent = '探索已开始，今天也向前一步。';
  exploreButton.querySelector('span').textContent = '✓';
});
