// Diceware-style passphrases from the EFF Large Wordlist.
import { randomInt } from './random.js';

export const SEPARATORS = Object.freeze({
  hyphen: '-',
  space: ' ',
  period: '.',
  underscore: '_',
});

export const MIN_WORDS = 3;
export const MAX_WORDS = 12;

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function generatePassphrase({ wordlist, words = 6, separator = 'hyphen', capitalizeWords = false, addNumber = false }) {
  if (!Array.isArray(wordlist) || wordlist.length < 2) throw new Error('Word list is missing.');
  if (!Number.isInteger(words) || words < MIN_WORDS || words > MAX_WORDS) {
    throw new Error(`Choose from ${MIN_WORDS} to ${MAX_WORDS} words.`);
  }
  const sep = SEPARATORS[separator];
  if (sep === undefined) throw new Error(`Unknown separator: ${separator}`);
  const picked = [];
  for (let i = 0; i < words; i++) {
    const w = wordlist[randomInt(wordlist.length)];
    picked.push(capitalizeWords ? capitalize(w) : w);
  }
  if (addNumber) {
    const at = randomInt(words);
    picked[at] = picked[at] + String(randomInt(10));
  }
  return picked.join(sep);
}

/**
 * Entropy in bits. Capitalisation and the separator are fixed choices, so
 * they add nothing. The optional digit adds log2(10 digits × word positions).
 */
export function passphraseEntropyBits({ wordlistSize, words, addNumber = false }) {
  let bits = words * Math.log2(wordlistSize);
  if (addNumber) bits += Math.log2(10 * words);
  return bits;
}
