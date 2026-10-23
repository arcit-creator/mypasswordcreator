// Random password generation and exact entropy calculation.
import { randomInt } from './random.js';

export const CHARACTER_CLASSES = Object.freeze({
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*-_=+?',
  extra: '()[]{}<>~|:;,./',
});

// Characters that are easy to misread in many fonts.
export const LOOKALIKES = '0Oo1lI|';

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

/** Returns the character sets actually in use, after filtering look-alikes. */
export function resolveClasses({ classes, avoidLookalikes = false }) {
  const keys = [...new Set(classes)];
  const sets = [];
  for (const key of keys) {
    const base = CHARACTER_CLASSES[key];
    if (base === undefined) throw new Error(`Unknown character class: ${key}`);
    const chars = avoidLookalikes ? [...base].filter((ch) => !LOOKALIKES.includes(ch)).join('') : base;
    if (chars.length > 0) sets.push({ key, chars });
  }
  return sets;
}

/**
 * Checks options and returns a user-facing problem, or null if valid.
 */
export function validateOptions(opts) {
  const { length, noRepeats = false } = opts;
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return `Choose a length from ${MIN_LENGTH} to ${MAX_LENGTH}.`;
  }
  const sets = resolveClasses(opts);
  if (sets.length === 0) return 'Turn on at least one character type.';
  const poolSize = sets.reduce((n, s) => n + s.chars.length, 0);
  if (noRepeats && length > poolSize) {
    return `Without repeats, the longest possible password from these characters is ${poolSize}. Shorten it or allow repeats.`;
  }
  if (length < sets.length) {
    return `A ${length}-character password can't include all ${sets.length} character types.`;
  }
  return null;
}

/**
 * Generates a password. Every selected character type is guaranteed to
 * appear at least once. Candidates that miss a type are discarded whole and
 * redrawn, so the result is uniform over all valid passwords.
 */
export function generatePassword(opts) {
  const problem = validateOptions(opts);
  if (problem) throw new Error(problem);
  const { length, noRepeats = false } = opts;
  const sets = resolveClasses(opts);
  const pool = sets.map((s) => s.chars).join('');

  for (let attempt = 0; attempt < 10000; attempt++) {
    let out;
    if (noRepeats) {
      const chars = [...pool];
      out = '';
      // Partial Fisher–Yates: draw without replacement.
      for (let i = 0; i < length; i++) {
        const j = i + randomInt(chars.length - i);
        [chars[i], chars[j]] = [chars[j], chars[i]];
        out += chars[i];
      }
    } else {
      out = '';
      for (let i = 0; i < length; i++) out += pool[randomInt(pool.length)];
    }
    if (sets.every((s) => [...out].some((ch) => s.chars.includes(ch)))) return out;
  }
  throw new Error('Could not build a password with these settings. Try a longer length.');
}

// ---- Exact entropy ---------------------------------------------------------

function bigPow(base, exp) {
  return BigInt(base) ** BigInt(exp);
}

function bigPerm(n, k) {
  if (k > n) return 0n;
  let r = 1n;
  for (let i = 0; i < k; i++) r *= BigInt(n - i);
  return r;
}

/** log2 of a positive BigInt, accurate to double precision. */
export function log2Big(n) {
  if (n <= 0n) return -Infinity;
  const bin = n.toString(2);
  const top = Math.min(53, bin.length);
  return Math.log2(parseInt(bin.slice(0, top), 2)) + (bin.length - top);
}

/**
 * Number of possible passwords for these options, counted exactly with
 * inclusion–exclusion over the "every type must appear" rule.
 */
export function countPossiblePasswords(opts) {
  if (validateOptions(opts)) return 0n;
  const { length, noRepeats = false } = opts;
  const sizes = resolveClasses(opts).map((s) => s.chars.length);
  const total = sizes.reduce((a, b) => a + b, 0);
  const f = noRepeats ? (m) => bigPerm(m, length) : (m) => bigPow(m, length);
  let count = 0n;
  const subsets = 1 << sizes.length;
  for (let mask = 0; mask < subsets; mask++) {
    let excluded = 0;
    let bits = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (mask & (1 << i)) {
        excluded += sizes[i];
        bits++;
      }
    }
    const term = f(total - excluded);
    count += bits % 2 === 0 ? term : -term;
  }
  return count;
}

/** Entropy in bits of a password drawn with these options. */
export function passwordEntropyBits(opts) {
  return log2Big(countPossiblePasswords(opts));
}

/** Labels each character for colour-coding in the UI. */
export function classifyChar(ch) {
  if (/[A-Z]/.test(ch)) return 'upper';
  if (/[a-z]/.test(ch)) return 'lower';
  if (/[0-9]/.test(ch)) return 'digit';
  return 'symbol';
}
