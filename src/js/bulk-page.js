import { passwordEntropyBits, validateOptions, sanitizeSymbols, resolveClasses, MIN_LENGTH, MAX_LENGTH } from '../core/generator.js';
import { passphraseEntropyBits, MIN_WORDS, MAX_WORDS } from '../core/passphrase.js';
import { EFF_WORDLIST } from '../core/eff-wordlist.js';
import { EFF_SHORT_WORDLIST } from '../core/eff-short-wordlist.js';
import { generateBulk, parseLabels, toCsv, toTsv, FORMULA_LEAD, MIN_COUNT, MAX_COUNT } from '../core/bulk.js';
import { describeStrength } from '../core/strength.js';
import { setRangeFill, copyText, toast, flashButton } from './ui.js';

// Only settings are remembered. Passwords and labels never touch storage.
const STORAGE_KEY = 'mpc.bulk.v1';
const RECOMMENDED = 16;
const LISTS = { long: EFF_WORDLIST, short: EFF_SHORT_WORDLIST };

const $ = (s, root = document) => root.querySelector(s);
const form = $('[data-controls]');
const countInput = $('[data-count]', form);
const countHint = $('[data-count-hint]', form);
const labelsInput = $('[data-labels]', form);
const labelsHint = $('[data-labels-hint]', form);
const range = $('[data-length-range]', form);
const number = $('[data-length-number]', form);
const lengthHint = $('[data-length-hint]', form);
const wordsRange = $('[data-words-range]', form);
const wordsNumber = $('[data-words-number]', form);
const customWrap = $('[data-custom-wrap]', form);
const customInput = $('[data-custom-symbols]', form);
const customHint = $('[data-custom-hint]', form);
const stdSymbols = $('[data-std-symbols]', form);
const genLabel = $('[data-generate-label]', form);
const strengthHint = $('[data-strength-hint]', form);
const result = $('[data-result]');
const resultTitle = $('[data-result-title]');
const tbody = $('[data-rows]');
const labelCol = $('[data-label-col]');
const valueCol = $('[data-value-col]');

let rows = [];
let rowsKind = 'password';

const kind = () => form.querySelector('input[name="kind"]:checked')?.value || 'password';
const radio = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;
const clamp = (n, lo, hi, def) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def);
const noun = (k, n) => (k === 'passphrase' ? (n === 1 ? 'passphrase' : 'passphrases') : (n === 1 ? 'password' : 'passwords'));

function passwordOptions() {
  const custom = form.elements.customon.checked;
  let classes = [...form.querySelectorAll('input[name="cls"]:checked')].map((i) => i.value);
  if (custom) {
    classes = classes.filter((c) => c !== 'symbols' && c !== 'extra');
    if (sanitizeSymbols(customInput.value)) classes.push('custom');
  }
  return {
    length: clamp(parseInt(number.value, 10), MIN_LENGTH, MAX_LENGTH, RECOMMENDED),
    classes,
    avoidLookalikes: form.elements.lookalikes.checked,
    noRepeats: form.elements.norepeats.checked,
    customSymbols: customInput.value,
  };
}

function passphraseOptions() {
  return {
    wordlist: LISTS[radio('list')] || EFF_WORDLIST,
    words: clamp(parseInt(wordsNumber.value, 10), MIN_WORDS, MAX_WORDS, 6),
    separator: radio('sep') || 'hyphen',
    capitalizeWords: form.elements.caps.checked,
    addNumber: form.elements.digit.checked,
  };
}

function plannedCount() {
  const { labels, truncated } = parseLabels(labelsInput.value);
  if (labels.length) return { n: labels.length, labels, truncated };
  return { n: clamp(parseInt(countInput.value, 10), MIN_COUNT, MAX_COUNT, 10), labels: [], truncated: 0 };
}

/** Bits per value. For passwords, removes the small share that would start with a formula character. */
function bitsEach() {
  if (kind() === 'passphrase') {
    const o = passphraseOptions();
    return passphraseEntropyBits({ wordlistSize: o.wordlist.length, words: o.words, addNumber: o.addNumber });
  }
  const o = passwordOptions();
  if (validateOptions(o)) return 0;
  const pool = resolveClasses(o).map((s) => s.chars).join('');
  const bad = [...pool].filter((c) => FORMULA_LEAD.includes(c)).length;
  return passwordEntropyBits(o) + Math.log2((pool.length - bad) / pool.length);
}

function save() {
  const data = {
    kind: kind(),
    count: clamp(parseInt(countInput.value, 10), MIN_COUNT, MAX_COUNT, 10),
    length: clamp(parseInt(number.value, 10), MIN_LENGTH, MAX_LENGTH, RECOMMENDED),
    classes: [...form.querySelectorAll('input[name="cls"]:checked')].map((i) => i.value),
    avoidLookalikes: form.elements.lookalikes.checked,
    noRepeats: form.elements.norepeats.checked,
    customOn: form.elements.customon.checked,
    customSymbols: customInput.value,
    words: clamp(parseInt(wordsNumber.value, 10), MIN_WORDS, MAX_WORDS, 6),
    list: radio('list'), sep: radio('sep'),
    caps: form.elements.caps.checked, digit: form.elements.digit.checked,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* optional */ }
}

function setRadio(name, value) {
  const el = form.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
  if (el) el.checked = true;
}

function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { s = null; }
  if (!s || typeof s !== 'object') return;
  if (s.kind) setRadio('kind', s.kind);
  if (Number.isInteger(s.count)) countInput.value = String(clamp(s.count, MIN_COUNT, MAX_COUNT, 10));
  if (Number.isInteger(s.length)) setLength(clamp(s.length, MIN_LENGTH, MAX_LENGTH, RECOMMENDED));
  if (Array.isArray(s.classes)) for (const i of form.querySelectorAll('input[name="cls"]')) i.checked = s.classes.includes(i.value);
  form.elements.lookalikes.checked = !!s.avoidLookalikes;
  form.elements.norepeats.checked = !!s.noRepeats;
  form.elements.customon.checked = !!s.customOn;
  if (typeof s.customSymbols === 'string') customInput.value = s.customSymbols.slice(0, 40);
  if (Number.isInteger(s.words)) setWords(clamp(s.words, MIN_WORDS, MAX_WORDS, 6));
  if (s.list) setRadio('list', s.list);
  if (s.sep) setRadio('sep', s.sep);
  form.elements.caps.checked = !!s.caps;
  form.elements.digit.checked = !!s.digit;
}

function setLength(n) {
  number.value = String(n);
  range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), n)));
  setRangeFill(range);
}
function setWords(n) {
  wordsNumber.value = String(n);
  wordsRange.value = String(n);
  setRangeFill(wordsRange);
}

/** Updates hints, visibility, and the button text. Doesn't generate. */
function refresh() {
  const k = kind();
  const isPp = k === 'passphrase';
  for (const el of form.querySelectorAll('[data-pw-only]')) el.hidden = isPp;
  for (const el of form.querySelectorAll('[data-pp-only]')) el.hidden = !isPp;
  const custom = form.elements.customon.checked;
  customWrap.hidden = !custom;
  stdSymbols.classList.toggle('is-off', custom);

  const { n, labels, truncated } = plannedCount();
  countInput.disabled = labels.length > 0;
  countHint.textContent = labels.length ? `Set by your list: ${labels.length}.` : `From ${MIN_COUNT} to ${MAX_COUNT}.`;
  labelsHint.classList.toggle('is-warn', truncated > 0);
  labelsHint.textContent = truncated > 0
    ? `Only the first ${MAX_COUNT} lines are used. ${truncated} more ${truncated === 1 ? 'was' : 'were'} left out.`
    : 'One per line. Each line gets its own password. Leave empty for unlabeled ones.';
  genLabel.textContent = `Generate ${n} ${noun(k, n)}`;

  if (!isPp) {
    const o = passwordOptions();
    lengthHint.classList.toggle('is-warn', o.length < RECOMMENDED);
    lengthHint.textContent = o.length < RECOMMENDED
      ? `Shorter than the recommended ${RECOMMENDED}. Use this only where the system won't accept more.`
      : `${RECOMMENDED} characters is the recommended minimum.`;
    if (custom) {
      const clean = sanitizeSymbols(customInput.value);
      customHint.classList.toggle('is-warn', clean.length === 0);
      customHint.textContent = clean.length === 0
        ? 'Type at least one symbol, or turn this option off for no symbols at all.'
        : `Using: ${[...clean].join(' ')}`;
    }
    const problem = validateOptions(o);
    if (problem) {
      strengthHint.classList.add('is-warn');
      strengthHint.textContent = problem;
      return;
    }
  }
  const s = describeStrength(bitsEach());
  strengthHint.classList.toggle('is-warn', s.rating.key === 'weak' || s.rating.key === 'fair');
  strengthHint.textContent = `Each one: ${s.rating.label.toLowerCase()}, about ${Math.round(s.bits)} bits. Guessing one would take ${s.timeText}.`;
  save();
}

function render() {
  const withLabels = rows.some((r) => r.label);
  labelCol.hidden = !withLabels;
  valueCol.textContent = rowsKind === 'passphrase' ? 'Passphrase' : 'Password';
  resultTitle.textContent = `${rows.length} ${noun(rowsKind, rows.length)}`;
  tbody.textContent = '';
  const frag = document.createDocumentFragment();
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const num = document.createElement('td');
    num.className = 'n';
    num.textContent = String(i + 1);
    tr.appendChild(num);
    if (withLabels) {
      const td = document.createElement('td');
      td.className = 'label';
      td.textContent = r.label;
      tr.appendChild(td);
    }
    const val = document.createElement('td');
    val.className = 'secret-cell';
    val.textContent = r.value;
    const act = document.createElement('td');
    act.className = 'act';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-quiet';
    b.textContent = 'Copy';
    b.dataset.i = String(i);
    b.setAttribute('aria-label', `Copy ${noun(rowsKind, 1)} ${i + 1}${r.label ? ` for ${r.label}` : ''}`);
    act.appendChild(b);
    tr.append(val, act);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  result.hidden = rows.length === 0;
}

function generate() {
  const k = kind();
  const { n, labels } = plannedCount();
  const options = k === 'passphrase' ? passphraseOptions() : passwordOptions();
  try {
    rows = generateBulk({ kind: k, count: n, labels, options });
    rowsKind = k;
  } catch (e) {
    toast(e.message);
    return;
  }
  render();
  result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function download() {
  if (!rows.length) return;
  // BOM so Excel reads labels with accents correctly.
  const csv = '﻿' + toCsv(rows, { valueHeader: rowsKind === 'passphrase' ? 'Passphrase' : 'Password' });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rowsKind === 'passphrase' ? 'passphrases' : 'passwords'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV saved. Delete it once it is imported.');
}

// ---- Events ----------------------------------------------------------------
range.addEventListener('input', () => { number.value = range.value; setRangeFill(range); refresh(); });
number.addEventListener('change', () => { setLength(clamp(parseInt(number.value, 10), MIN_LENGTH, MAX_LENGTH, RECOMMENDED)); refresh(); });
wordsRange.addEventListener('input', () => { wordsNumber.value = wordsRange.value; setRangeFill(wordsRange); refresh(); });
wordsNumber.addEventListener('change', () => { setWords(clamp(parseInt(wordsNumber.value, 10), MIN_WORDS, MAX_WORDS, 6)); refresh(); });
countInput.addEventListener('change', () => { countInput.value = String(clamp(parseInt(countInput.value, 10), MIN_COUNT, MAX_COUNT, 10)); refresh(); });
countInput.addEventListener('input', refresh);
labelsInput.addEventListener('input', refresh);
customInput.addEventListener('input', refresh);
form.addEventListener('change', refresh);
form.addEventListener('submit', (e) => { e.preventDefault(); generate(); });

tbody.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  const r = rows[Number(b.dataset.i)];
  if (r && await copyText(r.value)) { flashButton(b, 'Copied'); toast('Copied to clipboard'); }
});
$('[data-copy-all]').addEventListener('click', async (e) => {
  if (!rows.length) return;
  const btn = e.currentTarget;
  if (await copyText(toTsv(rows))) {
    flashButton(btn, 'Copied');
    toast(`${rows.length} copied. Pastes into a spreadsheet as columns.`);
  } else {
    toast('Copy failed. Use Download CSV instead.');
  }
});
$('[data-download]').addEventListener('click', download);
$('[data-clear]').addEventListener('click', () => {
  rows = [];
  render();
  toast('Cleared from this page');
});

restore();
setRangeFill(range);
setRangeFill(wordsRange);
refresh();
