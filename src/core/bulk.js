// Bulk generation for admins: many passwords or passphrases at once, with
// optional labels, exported as CSV. Everything runs on the device.
import { generatePassword, validateOptions } from './generator.js';
import { generatePassphrase } from './passphrase.js';

export const MIN_COUNT = 1;
export const MAX_COUNT = 250;
export const MAX_LABEL_LENGTH = 200;

// Characters that make Excel, LibreOffice, and Google Sheets treat a cell as
// a formula when the CSV is opened (OWASP "CSV injection").
export const FORMULA_LEAD = ['=', '+', '-', '@', '\t', '\r'];

export const startsLikeFormula = (s) => s.length > 0 && FORMULA_LEAD.includes(s[0]);

/**
 * Splits pasted text into labels: one per line, trimmed, blank lines dropped.
 * Returns at most MAX_COUNT labels and says whether any were cut off.
 */
export function parseLabels(text = '') {
  const all = String(text)
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim().slice(0, MAX_LABEL_LENGTH))
    .filter((l) => l.length > 0);
  return { labels: all.slice(0, MAX_COUNT), truncated: Math.max(0, all.length - MAX_COUNT) };
}

/**
 * Generates one secret that does not start with a formula character. Unsafe
 * candidates are discarded whole and redrawn, so the result stays uniform over
 * all the safe ones.
 */
function safeOne(make) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const s = make();
    if (!startsLikeFormula(s)) return s;
  }
  throw new Error('These settings only make passwords that start with = + - or @. Add another character type.');
}

/**
 * Builds a batch.
 *   kind: 'password' (uses generator.js options) or 'passphrase' (uses passphrase.js options)
 *   count: how many when there are no labels
 *   labels: optional list; when given, one secret per label and count is ignored
 * Returns [{ label, value }]. Values in a batch are always distinct.
 */
export function generateBulk({ kind = 'password', count = 10, labels = [], options = {} }) {
  const n = labels.length > 0 ? labels.length : count;
  if (!Number.isInteger(n) || n < MIN_COUNT || n > MAX_COUNT) {
    throw new Error(`Choose from ${MIN_COUNT} to ${MAX_COUNT} at a time.`);
  }
  let make;
  if (kind === 'password') {
    const problem = validateOptions(options);
    if (problem) throw new Error(problem);
    make = () => generatePassword(options);
  } else if (kind === 'passphrase') {
    make = () => generatePassphrase(options);
  } else {
    throw new Error(`Unknown kind: ${kind}`);
  }

  const seen = new Set();
  const rows = [];
  let misses = 0;
  while (rows.length < n) {
    const value = safeOne(make);
    if (seen.has(value)) {
      if (++misses > n * 20 + 1000) {
        throw new Error(`These settings can't make ${n} different values. Make them longer or turn on more character types.`);
      }
      continue;
    }
    seen.add(value);
    rows.push({ label: labels[rows.length] ?? '', value });
  }
  return rows;
}

/**
 * One CSV cell. Text that would run as a formula gets a leading apostrophe
 * (the OWASP-recommended defence), then the cell is always quoted with inner
 * quotes doubled, so commas, quotes, and line breaks can't break the row.
 */
export function csvCell(value) {
  let s = String(value ?? '');
  if (startsLikeFormula(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Builds the CSV text (CRLF line endings, header row). Labels column only when used. */
export function toCsv(rows, { valueHeader = 'Password' } = {}) {
  const withLabels = rows.some((r) => r.label);
  const head = withLabels ? ['Label', valueHeader] : [valueHeader];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) lines.push((withLabels ? [r.label, r.value] : [r.value]).map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Tab-separated text for the clipboard (pastes into a spreadsheet as columns). */
export function toTsv(rows) {
  const withLabels = rows.some((r) => r.label);
  const clean = (s) => {
    const t = String(s).replace(/[\t\r\n]+/g, ' ');
    return startsLikeFormula(t) ? "'" + t : t;
  };
  return rows.map((r) => (withLabels ? `${clean(r.label)}\t${clean(r.value)}` : clean(r.value))).join('\r\n');
}
