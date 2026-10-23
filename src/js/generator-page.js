import { generatePassword, passwordEntropyBits, validateOptions, sanitizeSymbols, MIN_LENGTH, MAX_LENGTH } from '../core/generator.js';
import { generatePin, pinEntropyBits, MIN_PIN, MAX_PIN } from '../core/pin.js';
import { describeStrength } from '../core/strength.js';
import { renderSecret, renderStrength, setRangeFill, copyText, toast, flashButton, createHistory } from './ui.js';

const STORAGE_KEY = 'mpc.generator.v2';
const RECOMMENDED = 16;

const vault = document.querySelector('[data-vault]');
const secretEl = vault.querySelector('[data-secret]');
const copyBtn = vault.querySelector('[data-copy]');
const copyLabel = copyBtn.querySelector('[data-label]');
const regenBtn = vault.querySelector('[data-regenerate]');
const form = document.querySelector('[data-controls]');
const range = form.querySelector('[data-length-range]');
const number = form.querySelector('[data-length-number]');
const hint = form.querySelector('[data-length-hint]');
const pinRange = form.querySelector('[data-pin-range]');
const pinNumber = form.querySelector('[data-pin-number]');
const pinHint = form.querySelector('[data-pin-hint]');
const customWrap = form.querySelector('[data-custom-wrap]');
const customInput = form.querySelector('[data-custom-symbols]');
const customHint = form.querySelector('[data-custom-hint]');
const stdSymbols = form.querySelector('[data-std-symbols]');
const history = createHistory(document.querySelector('[data-history]'), { fileLabel: 'Password' });

let current = '';

const mode = () => form.querySelector('input[name="mode"]:checked')?.value || 'password';
const clamp = (n, lo, hi, def) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def);

function readOptions() {
  const custom = form.elements.customon.checked;
  let classes = [...form.querySelectorAll('input[name="cls"]:checked')].map((i) => i.value);
  if (custom) classes = classes.filter((c) => c !== 'symbols' && c !== 'extra').concat('custom');
  return {
    length: clamp(parseInt(number.value, 10), MIN_LENGTH, MAX_LENGTH, RECOMMENDED),
    classes,
    avoidLookalikes: form.elements.lookalikes.checked,
    noRepeats: form.elements.norepeats.checked,
    customSymbols: customInput.value,
  };
}

function readPin() {
  return { length: clamp(parseInt(pinNumber.value, 10), MIN_PIN, MAX_PIN, 6), avoidWeak: form.elements.avoidweak.checked };
}

function save() {
  const o = readOptions();
  const data = {
    mode: mode(), length: o.length, avoidLookalikes: o.avoidLookalikes, noRepeats: o.noRepeats,
    classes: [...form.querySelectorAll('input[name="cls"]:checked')].map((i) => i.value),
    customOn: form.elements.customon.checked, customSymbols: customInput.value, pin: readPin(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* optional */ }
}

function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { s = null; }
  if (!s || typeof s !== 'object') return;
  if (s.mode === 'pin') form.querySelector('input[name="mode"][value="pin"]').checked = true;
  if (Number.isInteger(s.length)) setLength(clamp(s.length, MIN_LENGTH, MAX_LENGTH, RECOMMENDED));
  if (Array.isArray(s.classes)) for (const i of form.querySelectorAll('input[name="cls"]')) i.checked = s.classes.includes(i.value);
  form.elements.lookalikes.checked = !!s.avoidLookalikes;
  form.elements.norepeats.checked = !!s.noRepeats;
  form.elements.customon.checked = !!s.customOn;
  if (typeof s.customSymbols === 'string') customInput.value = s.customSymbols.slice(0, 40);
  if (s.pin && Number.isInteger(s.pin.length)) setPinLength(clamp(s.pin.length, MIN_PIN, MAX_PIN, 6));
  if (s.pin && s.pin.avoidWeak === false) form.elements.avoidweak.checked = false;
}

function setLength(n) {
  number.value = String(n);
  range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), n)));
  setRangeFill(range);
}
function setPinLength(n) {
  pinNumber.value = String(n);
  pinRange.value = String(n);
  setRangeFill(pinRange);
}

function syncVisibility() {
  const isPin = mode() === 'pin';
  for (const el of form.querySelectorAll('[data-pw-only]')) el.hidden = isPin;
  form.querySelector('[data-pin-only]').hidden = !isPin;
  const custom = form.elements.customon.checked;
  customWrap.hidden = !custom;
  stdSymbols.classList.toggle('is-off', custom);
  copyLabel.dataset.original = isPin ? 'Copy PIN' : 'Copy password';
  if (!copyBtn.classList.contains('is-done')) copyLabel.textContent = copyLabel.dataset.original;
  secretEl.setAttribute('aria-label', isPin ? 'Generated PIN' : 'Generated password');
  regenBtn.querySelector('[data-new-label]').textContent = isPin ? 'New PIN' : 'New password';
}

function showProblem(problem) {
  current = '';
  secretEl.classList.add('is-error');
  secretEl.textContent = problem;
  copyBtn.disabled = true;
  renderStrength(vault, { bits: 0, rating: { key: 'weak', label: 'Nothing generated' }, timeText: 'nothing' });
  vault.querySelector('[data-meter-detail]').textContent = 'Change the settings below.';
}

function show(value, bits) {
  current = value;
  secretEl.classList.remove('is-error');
  renderSecret(secretEl, current);
  copyBtn.disabled = false;
  renderStrength(vault, describeStrength(bits));
}

function generate() {
  syncVisibility();
  save();
  if (mode() === 'pin') {
    const p = readPin();
    pinHint.classList.toggle('is-warn', p.length < 6);
    pinHint.textContent = p.length < 6
      ? 'A 4-digit PIN is only safe where the device locks after a few wrong tries, like a phone or bank card.'
      : 'Use 6 digits or more where the device allows it.';
    show(generatePin(p), pinEntropyBits(p));
    vault.querySelector('[data-meter-detail]').textContent += ' PINs rely on lockouts after a few wrong tries, so this estimate is for an offline attack.';
    return;
  }
  const opts = readOptions();
  hint.classList.toggle('is-warn', opts.length < RECOMMENDED);
  hint.textContent = opts.length < RECOMMENDED
    ? `Shorter than the recommended ${RECOMMENDED}. Use this only where a site won't accept more.`
    : `${RECOMMENDED} characters is the recommended minimum.`;
  if (form.elements.customon.checked) {
    const clean = sanitizeSymbols(customInput.value);
    customHint.classList.toggle('is-warn', clean.length === 0);
    customHint.textContent = clean.length === 0
      ? 'Type at least one symbol, or turn this option off for no symbols at all.'
      : `Using: ${[...clean].join(' ')}`;
    if (clean.length === 0) opts.classes = opts.classes.filter((c) => c !== 'custom');
  }
  const problem = validateOptions(opts);
  if (problem) return showProblem(problem);
  show(generatePassword(opts), passwordEntropyBits(opts));
}

range.addEventListener('input', () => { number.value = range.value; setRangeFill(range); generate(); });
number.addEventListener('change', () => { setLength(clamp(parseInt(number.value, 10), MIN_LENGTH, MAX_LENGTH, RECOMMENDED)); generate(); });
pinRange.addEventListener('input', () => { pinNumber.value = pinRange.value; setRangeFill(pinRange); generate(); });
pinNumber.addEventListener('change', () => { setPinLength(clamp(parseInt(pinNumber.value, 10), MIN_PIN, MAX_PIN, 6)); generate(); });
customInput.addEventListener('input', generate);
form.addEventListener('change', (e) => {
  if ([number, range, pinNumber, pinRange, customInput].includes(e.target)) return;
  generate();
});
form.addEventListener('submit', (e) => e.preventDefault());

regenBtn.addEventListener('click', generate);
copyBtn.addEventListener('click', async () => {
  if (!current) return;
  const what = mode() === 'pin' ? 'PIN' : 'Password';
  if (await copyText(current)) {
    flashButton(copyBtn, 'Copied');
    toast(`${what} copied to clipboard`);
    history.add(current);
  } else {
    toast(`Copy failed. Select the ${what.toLowerCase()} and copy it manually.`);
  }
});

restore();
setRangeFill(range);
setRangeFill(pinRange);
generate();
