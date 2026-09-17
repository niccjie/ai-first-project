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
  if (!sections.length) return;
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

// Content remains visible when IntersectionObserver is unavailable.
if ('IntersectionObserver' in window) {
  const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.project-card, .studio-card').forEach((card) => {
    cardObserver.observe(card);
  });
}
