// Cryptographically secure, unbiased random integers.
// Uses the browser's (or Node's) Web Crypto API. Never Math.random().

const UINT32_RANGE = 2 ** 32;

function getCrypto() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Secure random numbers are not available in this browser.');
  }
  return c;
}

/**
 * Returns a uniformly distributed integer in [0, max).
 * Rejection sampling removes modulo bias: values at or above the largest
 * multiple of `max` that fits in 32 bits are thrown away and redrawn.
 */
export function randomInt(max) {
  if (!Number.isInteger(max) || max < 1 || max > UINT32_RANGE) {
    throw new RangeError(`randomInt: max must be an integer from 1 to 2^32, got ${max}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % max);
  const buf = new Uint32Array(1);
  const c = getCrypto();
  for (;;) {
    c.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** Picks one element uniformly at random. */
export function randomItem(list) {
  return list[randomInt(list.length)];
}

/** In-place Fisher–Yates shuffle using secure randomness. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
