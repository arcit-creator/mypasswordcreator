// Random numeric PINs that avoid the codes people (and attackers) try first.
import { randomInt } from './random.js';

export const MIN_PIN = 4;
export const MAX_PIN = 12;

// The most common 4-digit PINs in leaked-PIN studies.
const COMMON_4 = new Set([
  '1234', '1111', '0000', '1212', '7777', '1004', '2000', '4444', '2222', '6969',
  '9999', '3333', '5555', '6666', '1122', '1313', '8888', '4321', '2001', '1010',
  '2580', '0852', '1478', '3698', '7410', '9630', '0007', '1337', '1999', '2468',
]);
const COMMON_6 = new Set(['123456', '654321', '111111', '000000', '121212', '123123', '112233', '159753', '696969', '147258', '258369']);

/** True for PINs that are easy to guess: repeats, runs, repeated chunks, years, and known favourites. */
export function isWeakPin(pin) {
  if (/^(\d)\1+$/.test(pin)) return true; // 0000, 777777
  const d = [...pin].map(Number);
  const steps = new Set(d.slice(1).map((x, i) => (x - d[i] + 10) % 10));
  if (steps.size === 1 && (steps.has(1) || steps.has(9))) return true; // 1234, 9876, 7890
  for (const size of [1, 2, 3]) {
    if (pin.length % size === 0 && pin.length > size && pin.slice(0, size).repeat(pin.length / size) === pin) return true; // 1212, 123123
  }
  if (pin.length === 4 && /^(19|20)\d\d$/.test(pin)) return true; // years
  if (pin.length === 4 && COMMON_4.has(pin)) return true;
  if (pin.length === 6 && COMMON_6.has(pin)) return true;
  return false;
}

export function generatePin({ length = 6, avoidWeak = true } = {}) {
  if (!Number.isInteger(length) || length < MIN_PIN || length > MAX_PIN) {
    throw new Error(`Choose a PIN length from ${MIN_PIN} to ${MAX_PIN}.`);
  }
  for (;;) {
    let pin = '';
    for (let i = 0; i < length; i++) pin += String(randomInt(10));
    if (!avoidWeak || !isWeakPin(pin)) return pin;
  }
}

const exactCache = new Map();
/** Entropy in bits. Exact up to 6 digits (by counting); beyond that the excluded PINs are negligible. */
export function pinEntropyBits({ length, avoidWeak = true }) {
  if (!avoidWeak || length > 6) return length * Math.log2(10);
  const key = length;
  if (!exactCache.has(key)) {
    const total = 10 ** length;
    let ok = 0;
    for (let n = 0; n < total; n++) if (!isWeakPin(String(n).padStart(length, '0'))) ok++;
    exactCache.set(key, Math.log2(ok));
  }
  return exactCache.get(key);
}
