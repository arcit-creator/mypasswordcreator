// "Get the app" page: shows install steps for the visitor's device, plus a
// one-click button where the browser supports it (Chrome, Edge, Android).

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isFirefox = /Firefox\/|FxiOS/.test(ua);
const isEdge = /Edg\//.test(ua);
const isChromium = /Chrome\/|Chromium\//.test(ua);
const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !isChromium && !isFirefox;
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const DEVICES = {
  iphone: {
    name: 'iPhone or iPad',
    steps: [
      'Open this page in Safari.',
      'Tap the Share button (the square with an arrow).',
      'Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.',
    ],
  },
  android: {
    name: 'Android',
    steps: [
      'Open this page in Chrome.',
      'Tap the menu (three dots) at the top right.',
      'Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
    ],
  },
  desktop: {
    name: 'Chrome or Edge on a computer',
    steps: [
      'Look for the install icon at the right end of the address bar.',
      'Or open the browser menu and choose the option to install this site as an app.',
    ],
  },
  mac: {
    name: 'Safari on a Mac',
    steps: [
      'In the menu bar, choose <strong>File</strong>, then <strong>Add to Dock</strong>.',
      'This needs macOS Sonoma or later.',
    ],
  },
  firefox: {
    name: 'Firefox on a computer',
    steps: [
      'Firefox on a computer can’t install sites as apps.',
      'Offline still works: bookmark this site, and it will open with no internet after your first visit.',
    ],
  },
};

function current() {
  if (isIOS) return 'iphone';
  if (isAndroid) return 'android';
  if (isMacSafari) return 'mac';
  if (isFirefox) return 'firefox';
  return 'desktop';
}

// Builds the steps from fixed strings above (no user input), then renders safely.
function stepsList(steps) {
  const ol = document.createElement('ol');
  ol.className = 'steps';
  for (const s of steps) {
    const li = document.createElement('li');
    const parts = s.split(/(<strong>.*?<\/strong>)/);
    for (const part of parts) {
      const m = part.match(/^<strong>(.*)<\/strong>$/);
      if (m) {
        const b = document.createElement('strong');
        b.textContent = m[1];
        li.appendChild(b);
      } else if (part) {
        li.appendChild(document.createTextNode(part));
      }
    }
    ol.appendChild(li);
  }
  return ol;
}

const here = current();
const title = document.querySelector('[data-install-title]');
const body = document.querySelector('[data-install-body]');
const btn = document.querySelector('[data-install-now]');
const status = document.querySelector('[data-offline-status]');
const list = document.querySelector('[data-device-list]');

if (standalone) {
  title.textContent = 'You’re using the app';
  const p = document.createElement('p');
  p.textContent = 'MyPasswordCreator is installed on this device. Try the airplane-mode test below.';
  body.appendChild(p);
} else {
  title.textContent = `Install on this device: ${DEVICES[here].name}`;
  body.appendChild(stepsList(DEVICES[here].steps));
}

for (const [key, d] of Object.entries(DEVICES)) {
  if (key === here && !standalone) continue;
  const block = document.createElement('div');
  block.className = 'device';
  const h = document.createElement('h3');
  h.textContent = d.name;
  block.append(h, stepsList(d.steps));
  list.appendChild(block);
}

// One-click install where the browser offers it. site.js captures the event on every page.
function offerButton() {
  if (standalone || !window.__mpcInstallPrompt) return;
  btn.hidden = false;
}
offerButton();
window.addEventListener('mpc:installable', offerButton);
btn.addEventListener('click', async () => {
  const e = window.__mpcInstallPrompt;
  if (!e) return;
  e.prompt();
  const choice = await e.userChoice;
  window.__mpcInstallPrompt = null;
  btn.hidden = true;
  if (choice.outcome === 'accepted') status.textContent = 'Installed. Look for MyPasswordCreator with your other apps.';
});
window.addEventListener('appinstalled', () => {
  btn.hidden = true;
  status.textContent = 'Installed. Look for MyPasswordCreator with your other apps.';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    status.textContent = 'This device has a saved copy, so the site already works offline here.';
    status.classList.add('is-ready');
  });
  setTimeout(() => {
    if (!status.classList.contains('is-ready')) status.textContent = 'Saving a copy for offline use. This takes a few seconds on the first visit.';
  }, 1500);
} else {
  status.textContent = 'This browser doesn’t support offline use.';
}
