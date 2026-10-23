import { generateWifiKey, wifiKeyEntropyBits, wifiQrPayload, WIFI_STYLES, WPA_MIN, WPA_MAX } from '../core/wifi.js';
import { describeStrength } from '../core/strength.js';
import qrcode from '../core/qrcode.js';
import { renderSecret, renderStrength, setRangeFill, copyText, toast, flashButton, createHistory } from './ui.js';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const STORAGE_KEY = 'mpc.wifi.v1';
const SVG_NS = 'http://www.w3.org/2000/svg';

const vault = document.querySelector('[data-vault]');
const secretEl = vault.querySelector('[data-secret]');
const copyBtn = vault.querySelector('[data-copy]');
const form = document.querySelector('[data-controls]');
const styleHint = form.querySelector('[data-style-hint]');
const sizeLabel = form.querySelector('[data-size-label]');
const range = form.querySelector('[data-size-range]');
const number = form.querySelector('[data-size-number]');
const cardForm = document.querySelector('[data-card-form]');
const ssidInput = cardForm.querySelector('[data-ssid]');
const ownWrap = cardForm.querySelector('[data-own-wrap]');
const ownInput = cardForm.querySelector('[data-own-password]');
const ownHint = cardForm.querySelector('[data-own-hint]');
const card = document.querySelector('[data-card]');
const cardSsid = card.querySelector('[data-card-ssid]');
const cardPass = card.querySelector('[data-card-pass]');
const cardPassBlock = card.querySelector('[data-card-pass-block]');
const cardQr = card.querySelector('[data-card-qr]');
const cardHint = document.querySelector('[data-card-hint]');
const printBtn = document.querySelector('[data-print]');
const history = createHistory(document.querySelector('[data-history]'), { fileLabel: 'Wi-Fi password' });

const STYLE_TEXT = {
  words: ['Number of words', 'Short words joined by hyphens. Easy to read out and to type on a TV or phone.'],
  easy: ['Number of characters', 'Lowercase letters and numbers only, with no look-alikes. Nothing to shift for.'],
  max: ['Number of characters', 'Random letters, numbers, and symbols, up to the 63-character Wi-Fi limit. Best joined by QR code.'],
};

let current = '';
const sizes = { words: WIFI_STYLES.words.def, easy: WIFI_STYLES.easy.def, max: WIFI_STYLES.max.def };

const style = () => form.querySelector('input[name="style"]:checked')?.value || 'words';
const security = () => cardForm.querySelector('input[name="security"]:checked')?.value || 'WPA';

function save() {
  const data = { style: style(), sizes, security: security(), hidden: cardForm.elements.hidden.checked };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* optional */ }
}

function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { s = null; }
  if (!s || typeof s !== 'object') return;
  if (s.style in WIFI_STYLES) form.querySelector(`input[name="style"][value="${s.style}"]`).checked = true;
  if (s.sizes) for (const k of Object.keys(WIFI_STYLES)) {
    const v = s.sizes[k];
    if (Number.isInteger(v) && v >= WIFI_STYLES[k].min && v <= WIFI_STYLES[k].max) sizes[k] = v;
  }
  if (s.security === 'nopass') cardForm.querySelector('input[name="security"][value="nopass"]').checked = true;
  cardForm.elements.hidden.checked = !!s.hidden;
  // Network names and passwords are never saved.
}

function applyStyleLimits() {
  const st = style();
  const lim = WIFI_STYLES[st];
  range.min = number.min = String(lim.min);
  range.max = number.max = String(lim.max);
  range.value = number.value = String(sizes[st]);
  sizeLabel.textContent = STYLE_TEXT[st][0];
  styleHint.textContent = STYLE_TEXT[st][1];
  setRangeFill(range);
}

function generate() {
  const st = style();
  current = generateWifiKey({ style: st, size: sizes[st] });
  renderSecret(secretEl, current, st === 'words' ? { separator: '-' } : {});
  secretEl.classList.toggle('is-passphrase', st === 'words');
  renderStrength(vault, describeStrength(wifiKeyEntropyBits({ style: st, size: sizes[st] })));
  save();
  updateCard();
}

function validOwn(pw) {
  return pw.length >= WPA_MIN && pw.length <= WPA_MAX && /^[\x20-\x7e]+$/.test(pw);
}

function cardPassword() {
  return cardForm.elements.own.checked ? ownInput.value : current;
}

function drawQr(payload) {
  cardQr.textContent = '';
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n + quiet * 2} ${n + quiet * 2}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#13233f');
  svg.append(bg, path);
  cardQr.appendChild(svg);
}

function updateCard() {
  const open = security() === 'nopass';
  const ssid = ssidInput.value.trim();
  const own = cardForm.elements.own.checked;
  ownWrap.hidden = !own || open;
  cardPassBlock.hidden = open;

  const pw = cardPassword();
  if (own && !open) {
    const ok = validOwn(pw);
    ownHint.classList.toggle('is-warn', !ok && pw.length > 0);
    ownHint.textContent = ok || pw.length === 0
      ? '8 to 63 characters.'
      : 'Wi-Fi passwords must be 8 to 63 characters, using standard keyboard characters.';
  }

  cardSsid.textContent = ssid || 'Your network name';
  cardSsid.classList.toggle('is-placeholder', !ssid);
  const sep = !own && style() === 'words' ? { separator: '-' } : {};
  renderSecret(cardPass, pw || '', sep);

  let problem = '';
  if (!ssid) problem = 'Enter the network name to make the QR code.';
  else if (!open && own && !validOwn(pw)) problem = 'Fix the password above to make the QR code.';

  if (problem) {
    cardQr.textContent = '';
    cardQr.classList.add('is-empty');
    cardHint.textContent = problem;
    printBtn.disabled = true;
    return;
  }
  cardQr.classList.remove('is-empty');
  drawQr(wifiQrPayload({ ssid, password: pw, security: security(), hidden: cardForm.elements.hidden.checked }));
  cardHint.textContent = 'Test it: scan the card with your phone before you print it.';
  printBtn.disabled = false;
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'style') { applyStyleLimits(); generate(); }
});
range.addEventListener('input', () => {
  number.value = range.value;
  sizes[style()] = Number(range.value);
  setRangeFill(range);
  generate();
});
number.addEventListener('change', () => {
  const lim = WIFI_STYLES[style()];
  const v = Math.min(lim.max, Math.max(lim.min, parseInt(number.value, 10) || lim.def));
  sizes[style()] = v;
  applyStyleLimits();
  generate();
});
form.addEventListener('submit', (e) => e.preventDefault());
cardForm.addEventListener('submit', (e) => e.preventDefault());
cardForm.addEventListener('input', () => { save(); updateCard(); });
cardForm.addEventListener('change', () => { save(); updateCard(); });
printBtn.addEventListener('click', () => window.print());

vault.querySelector('[data-regenerate]').addEventListener('click', generate);
copyBtn.addEventListener('click', async () => {
  if (!current) return;
  if (await copyText(current)) {
    flashButton(copyBtn, 'Copied');
    toast('Wi-Fi password copied to clipboard');
    history.add(current);
  } else {
    toast('Copy failed. Select the password and copy it manually.');
  }
});

restore();
applyStyleLimits();
generate();
