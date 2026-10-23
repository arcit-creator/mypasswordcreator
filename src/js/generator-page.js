import { generatePassword, passwordEntropyBits, validateOptions, MIN_LENGTH, MAX_LENGTH } from '../core/generator.js';
import { describeStrength } from '../core/strength.js';
import { renderSecret, renderStrength, setRangeFill, copyText, toast, flashButton, createHistory } from './ui.js';

const STORAGE_KEY = 'mpc.generator.v1';
const RECOMMENDED = 16;

const vault = document.querySelector('[data-vault]');
const secretEl = vault.querySelector('[data-secret]');
const copyBtn = vault.querySelector('[data-copy]');
const regenBtn = vault.querySelector('[data-regenerate]');
const form = document.querySelector('[data-controls]');
const range = form.querySelector('[data-length-range]');
const number = form.querySelector('[data-length-number]');
const hint = form.querySelector('[data-length-hint]');
const history = createHistory(document.querySelector('[data-history]'), { fileLabel: 'Password' });

let current = '';

function readOptions() {
  return {
    length: clampLength(parseInt(number.value, 10)),
    classes: [...form.querySelectorAll('input[name="cls"]:checked')].map((i) => i.value),
    avoidLookalikes: form.elements.lookalikes.checked,
    noRepeats: form.elements.norepeats.checked,
  };
}

function clampLength(n) {
  if (!Number.isFinite(n)) return RECOMMENDED;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n));
}

function save(opts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch { /* optional */ }
}

function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  if (Number.isInteger(saved.length)) setLength(clampLength(saved.length));
  if (Array.isArray(saved.classes)) {
    for (const input of form.querySelectorAll('input[name="cls"]')) input.checked = saved.classes.includes(input.value);
  }
  form.elements.lookalikes.checked = !!saved.avoidLookalikes;
  form.elements.norepeats.checked = !!saved.noRepeats;
}

function setLength(n) {
  number.value = String(n);
  range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), n)));
  setRangeFill(range);
}

function updateHint(length) {
  hint.classList.toggle('is-warn', length < RECOMMENDED);
  if (length < RECOMMENDED) {
    hint.textContent = `Shorter than the recommended ${RECOMMENDED}. Use this only where a site won't accept more.`;
  } else {
    hint.textContent = `${RECOMMENDED} characters is the recommended minimum.`;
  }
}

function generate() {
  const opts = readOptions();
  updateHint(opts.length);
  const problem = validateOptions(opts);
  if (problem) {
    current = '';
    secretEl.classList.add('is-error');
    secretEl.textContent = problem;
    copyBtn.disabled = true;
    renderStrength(vault, { bits: 0, rating: { key: 'weak', label: 'No password' }, timeText: 'nothing' });
    vault.querySelector('[data-meter-detail]').textContent = 'Change the settings above.';
    return;
  }
  save(opts);
  current = generatePassword(opts);
  secretEl.classList.remove('is-error');
  renderSecret(secretEl, current);
  copyBtn.disabled = false;
  renderStrength(vault, describeStrength(passwordEntropyBits(opts)));
}

range.addEventListener('input', () => {
  number.value = range.value;
  setRangeFill(range);
  generate();
});
number.addEventListener('change', () => {
  setLength(clampLength(parseInt(number.value, 10)));
  generate();
});
form.addEventListener('change', (e) => {
  if (e.target === number || e.target === range) return;
  generate();
});
form.addEventListener('submit', (e) => e.preventDefault());

regenBtn.addEventListener('click', generate);
copyBtn.addEventListener('click', async () => {
  if (!current) return;
  if (await copyText(current)) {
    flashButton(copyBtn, 'Copied');
    toast('Password copied to clipboard');
    history.add(current);
  } else {
    toast('Copy failed. Select the password and copy it manually.');
  }
});

restore();
setRangeFill(range);
generate();
