// Small shared UI helpers.
import { classifyChar } from '../core/generator.js';

let toastTimer;
export function toast(message) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** Renders a secret into `el` with digits and symbols colour-coded. Uses text nodes only. */
export function renderSecret(el, text, { separator = null } = {}) {
  el.textContent = '';
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const span = document.createElement('span');
    span.textContent = ch;
    if (separator !== null && ch === separator) span.className = 'c-sep';
    else {
      const k = classifyChar(ch);
      if (k === 'digit') span.className = 'c-digit';
      else if (k === 'symbol') span.className = 'c-symbol';
    }
    frag.appendChild(span);
  }
  el.appendChild(frag);
}

/** Updates the vault strength readout. */
export function renderStrength(root, { bits, rating, timeText }) {
  const label = root.querySelector('[data-rating]');
  const detail = root.querySelector('[data-meter-detail]');
  const bar = root.querySelector('[data-meter-bar]');
  label.textContent = rating.label;
  label.dataset.level = rating.key;
  detail.textContent = `${Math.round(bits)} bits of entropy. Guessing it would take ${timeText}.`;
  bar.dataset.level = rating.key;
  bar.firstElementChild.style.width = `${Math.max(6, Math.min(100, (bits / 128) * 100))}%`;
}

export function setRangeFill(range) {
  const min = Number(range.min), max = Number(range.max), v = Number(range.value);
  range.style.setProperty('--pct', `${((v - min) / (max - min)) * 100}%`);
}

export function flashButton(btn, doneText) {
  const label = btn.querySelector('[data-label]') || btn;
  const original = label.dataset.original || label.textContent;
  label.dataset.original = original;
  label.textContent = doneText;
  btn.classList.add('is-done');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    label.textContent = original;
    btn.classList.remove('is-done');
  }, 1800);
}

/** Session-only list of copied secrets. Lives in memory; gone when the tab closes. */
export function createHistory(root, { max = 10, fileLabel = 'Password' } = {}) {
  const list = root.querySelector('[data-history-list]');
  const empty = root.querySelector('[data-history-empty]');
  const foot = root.querySelector('[data-history-foot]');
  let items = [];

  function render() {
    list.textContent = '';
    empty.hidden = items.length > 0;
    foot.hidden = items.length === 0;
    items.forEach((item, i) => {
      const li = document.createElement('li');
      const secret = document.createElement('div');
      secret.className = 'h-secret';
      secret.textContent = item.value;
      const row = document.createElement('div');
      row.className = 'h-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add a label, e.g. router admin';
      input.value = item.label;
      input.maxLength = 80;
      input.setAttribute('aria-label', `Label for item ${i + 1}`);
      input.addEventListener('input', () => { item.label = input.value; });
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn-quiet';
      copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        if (await copyText(item.value)) { flashButton(copy, 'Copied'); toast('Copied to clipboard'); }
      });
      row.append(input, copy);
      li.append(secret, row);
      list.appendChild(li);
    });
  }

  function add(value) {
    if (items[0]?.value === value) return;
    items.unshift({ value, label: '' });
    if (items.length > max) items.pop();
    render();
  }

  function clear() { items = []; render(); }

  function download() {
    if (!items.length) return;
    const lines = [
      'MyPasswordCreator.com — copied this session',
      `Saved ${new Date().toLocaleString()}`,
      '',
      'WARNING: this is an unencrypted text file. Move these into a password',
      'manager, then delete this file and empty your trash.',
      '',
    ];
    for (const it of items) {
      lines.push(`${it.label.trim() || '(no label)'}`);
      lines.push(`${fileLabel}: ${it.value}`);
      lines.push('');
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passwords.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  root.querySelector('[data-history-clear]')?.addEventListener('click', clear);
  root.querySelector('[data-history-download]')?.addEventListener('click', download);
  render();
  return { add, clear };
}
