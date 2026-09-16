const exploreButton = document.querySelector('#explore-button');
const buttonMessage = document.querySelector('#button-message');

exploreButton.addEventListener('click', () => {
  document.body.classList.add('explored');
  exploreButton.classList.add('is-clicked');
  buttonMessage.textContent = '探索已开始，今天也向前一步。';
  exploreButton.querySelector('span').textContent = '✓';
});

const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('main > section[id]');

function setActiveSection(id) {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

let scrollPending = false;
function updateNavigation() {
  let current = sections[0].id;
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= window.innerHeight * 0.35) {
      current = section.id;
    }
  });
  setActiveSection(current);
  scrollPending = false;
}

window.addEventListener('scroll', () => {
  if (!scrollPending) {
    scrollPending = true;
    window.requestAnimationFrame(updateNavigation);
  }
}, { passive: true });
window.addEventListener('resize', updateNavigation);
updateNavigation();
