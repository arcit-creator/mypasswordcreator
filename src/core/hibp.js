// Have I Been Pwned "Pwned Passwords" range lookup using k-anonymity.
// Only the first 5 hex characters of the SHA-1 hash ever leave the browser.

export const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function sha1Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export class LookupError extends Error {}

/** Parses a range response and returns the breach count for `suffix`. */
export function findSuffixCount(body, suffix) {
  const target = suffix.toUpperCase();
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    if (line.slice(0, idx).toUpperCase() === target) {
      const n = parseInt(line.slice(idx + 1), 10);
      return Number.isFinite(n) ? n : 0; // padded rows have a count of 0
    }
  }
  return 0;
}

/**
 * Creates a checker with a per-prefix cache (useful for bulk audits).
 * Requests ask HIBP to pad responses so their size doesn't hint at the
 * prefix. If the browser rejects the padding header, it falls back once.
 */
export function createChecker({ fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const cache = new Map();
  let usePadding = true;

  async function fetchRange(prefix) {
    const url = HIBP_RANGE_URL + prefix;
    if (usePadding) {
      try {
        const res = await fetchImpl(url, { headers: { 'Add-Padding': 'true' }, referrerPolicy: 'no-referrer', cache: 'no-store' });
        if (res.ok) return res.text();
        if (res.status !== 400) throw new LookupError(`HIBP returned ${res.status}`);
      } catch (err) {
        if (err instanceof LookupError) throw err;
        // Network/CORS failure: retry once without the custom header.
      }
      usePadding = false;
    }
    let res;
    try {
      res = await fetchImpl(url, { referrerPolicy: 'no-referrer', cache: 'no-store' });
    } catch {
      throw new LookupError('Network error');
    }
    if (!res.ok) throw new LookupError(`HIBP returned ${res.status}`);
    return res.text();
  }

  function range(prefix) {
    if (!cache.has(prefix)) {
      const p = fetchRange(prefix);
      cache.set(prefix, p);
      p.catch(() => cache.delete(prefix));
    }
    return cache.get(prefix);
  }

  /** Resolves to the number of breaches the password appears in (0 = not found). Throws LookupError. */
  async function check(password) {
    if (!password) throw new Error('Enter a password to check.');
    const hash = await sha1Hex(password);
    const body = await range(hash.slice(0, 5));
    return findSuffixCount(body, hash.slice(5));
  }

  return { check };
}

/** Runs `worker` over items with limited concurrency, preserving order. */
export async function mapLimit(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      done++;
      onProgress?.(done, items.length, i, results[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
