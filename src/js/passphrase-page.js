import { generatePassphrase, passphraseEntropyBits, SEPARATORS, MIN_WORDS, MAX_WORDS } from '../core/passphrase.js';
import { EFF_WORDLIST } from '../core/eff-wordlist.js';
import { describeStrength } from '../core/strength.js';
import { renderSecret, renderStrength, setRangeFill, copyText, toast, flashButton, createHistory } from './ui.js';

const STORAGE_KEY = 'mpc.passphrase.v1';
const RECOMMENDED = 6;

const vault = document.querySelector('[data-vault]');
const secretEl = vault.querySelector('[data-secret]');
const copyBtn = vault.querySelector('[data-copy]');
const form = document.querySelector('[data-controls]');
const range = form.querySelector('[data-words-range]');
const number = form.querySelector('[data-words-number]');
const hint = form.querySelector('[data-words-hint]');
const history = createHistory(document.querySelector('[data-history]'), { fileLabel: 'Passphrase' });
secretEl.classList.add('is-passphrase');

let current = '';

const clamp = (n) => (Number.isFinite(n) ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, n)) : RECOMMENDED);

function readOptions() {
  return {
    words: clamp(parseInt(number.value, 10)),
    separator: form.querySelector('input[name="sep"]:checked')?.value || 'hyphen',
    capitalizeWords: form.elements.caps.checked,
    addNumber: form.elements.digit.checked,
  };
}

function setWords(n) {
  number.value = String(n);
  range.value = String(n);
  setRangeFill(range);
}

function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { s = null; }
  if (!s || typeof s !== 'object') return;
  if (Number.isInteger(s.words)) setWords(clamp(s.words));
  if (s.separator in SEPARATORS) {
    const r = form.querySelector(`input[name="sep"][value="${s.separator}"]`);
    if (r) r.checked = true;
  }
  form.elements.caps.checked = !!s.capitalizeWords;
  form.elements.digit.checked = !!s.addNumber;
}

function generate() {
  const opts = readOptions();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch { /* optional */ }
  hint.classList.toggle('is-warn', opts.words < 5);
  hint.textContent = opts.words < 5
    ? 'Fewer than 5 words is weak on its own. Pair it with two-factor authentication.'
    : 'Six words is the EFF’s recommendation.';
  current = generatePassphrase({ wordlist: EFF_WORDLIST, ...opts });
  renderSecret(secretEl, current, { separator: SEPARATORS[opts.separator] });
  renderStrength(vault, describeStrength(passphraseEntropyBits({ wordlistSize: EFF_WORDLIST.length, words: opts.words, addNumber: opts.addNumber })));
}

range.addEventListener('input', () => { number.value = range.value; setRangeFill(range); generate(); });
number.addEventListener('change', () => { setWords(clamp(parseInt(number.value, 10))); generate(); });
form.addEventListener('change', (e) => { if (e.target !== number && e.target !== range) generate(); });
form.addEventListener('submit', (e) => e.preventDefault());
vault.querySelector('[data-regenerate]').addEventListener('click', generate);
copyBtn.addEventListener('click', async () => {
  if (!current) return;
  if (await copyText(current)) {
    flashButton(copyBtn, 'Copied');
    toast('Passphrase copied to clipboard');
    history.add(current);
  } else {
    toast('Copy failed. Select the passphrase and copy it manually.');
  }
});

restore();
setRangeFill(range);
generate();
