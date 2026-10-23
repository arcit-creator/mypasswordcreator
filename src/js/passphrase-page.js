import { generatePassphrase, passphraseEntropyBits, SEPARATORS, MIN_WORDS, MAX_WORDS } from '../core/passphrase.js';
import { EFF_WORDLIST } from '../core/eff-wordlist.js';
import { EFF_SHORT_WORDLIST } from '../core/eff-short-wordlist.js';
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
const listHint = form.querySelector('[data-list-hint]');
const LISTS = { long: EFF_WORDLIST, short: EFF_SHORT_WORDLIST };
const history = createHistory(document.querySelector('[data-history]'), { fileLabel: 'Passphrase' });
secretEl.classList.add('is-passphrase');

let current = '';

const clamp = (n) => (Number.isFinite(n) ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, n)) : RECOMMENDED);

function readOptions() {
  return {
    words: clamp(parseInt(number.value, 10)),
    list: form.querySelector('input[name="list"]:checked')?.value === 'short' ? 'short' : 'long',
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
  if (s.list === 'short') form.querySelector('input[name="list"][value="short"]').checked = true;
  form.elements.caps.checked = !!s.capitalizeWords;
  form.elements.digit.checked = !!s.addNumber;
}

function generate() {
  const opts = readOptions();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch { /* optional */ }
  const wordlist = LISTS[opts.list];
  const short = opts.list === 'short';
  listHint.textContent = short
    ? '1,296 words of 3 to 5 letters. Easier to type on a TV remote, but use 8 or more.'
    : '7,776 everyday words. The strongest per word.';
  const weakBelow = short ? 7 : 5;
  hint.classList.toggle('is-warn', opts.words < weakBelow);
  hint.textContent = opts.words < weakBelow
    ? (short ? 'Short words are weaker each, so use at least 7, ideally 8.' : 'Fewer than 5 words is weak on its own. Pair it with two-factor authentication.')
    : (short ? 'Eight short words match six standard ones.' : 'Six words is the EFF\u2019s recommendation.');
  current = generatePassphrase({ wordlist, words: opts.words, separator: opts.separator, capitalizeWords: opts.capitalizeWords, addNumber: opts.addNumber });
  renderSecret(secretEl, current, { separator: SEPARATORS[opts.separator] });
  renderStrength(vault, describeStrength(passphraseEntropyBits({ wordlistSize: wordlist.length, words: opts.words, addNumber: opts.addNumber })));
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
