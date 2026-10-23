// Shared behaviour for every page: mobile menu.

const menuBtn = document.querySelector('[data-menu-toggle]');
const nav = document.getElementById('site-nav');
menuBtn?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav?.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.focus();
  }
});
