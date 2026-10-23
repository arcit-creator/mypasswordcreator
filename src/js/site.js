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

// Offline support: keep a copy of the site on this device.
const note = document.querySelector('[data-offline-note]');
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      if (note) {
        note.textContent = 'Saved for offline use. This site keeps working with your internet turned off.';
        note.hidden = false;
      }
    }).catch(() => { /* offline support is optional */ });
  });
}

// Install prompt (Chrome, Edge, Android). Captured on every page; the /app page offers the button.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__mpcInstallPrompt = e;
  window.dispatchEvent(new Event('mpc:installable'));
});
