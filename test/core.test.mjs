import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from '../src/core/random.js';
import {
  generatePassword, passwordEntropyBits, countPossiblePasswords, validateOptions,
  resolveClasses, LOOKALIKES, CHARACTER_CLASSES, log2Big,
} from '../src/core/generator.js';
import { generatePassphrase, passphraseEntropyBits } from '../src/core/passphrase.js';
import { describeDuration, rate, averageSecondsToGuess } from '../src/core/strength.js';
import { sha1Hex, findSuffixCount, createChecker, LookupError, mapLimit } from '../src/core/hibp.js';
import { EFF_WORDLIST } from '../src/core/eff-wordlist.js';

const ALL = ['upper', 'lower', 'digits', 'symbols'];

test('randomInt stays in range and is roughly uniform', () => {
  const counts = new Array(7).fill(0);
  const N = 70000;
  for (let i = 0; i < N; i++) counts[randomInt(7)]++;
  for (const c of counts) assert.ok(Math.abs(c - N / 7) < N / 7 * 0.05, `bucket ${c}`);
  assert.equal(randomInt(1), 0);
  assert.throws(() => randomInt(0));
  assert.throws(() => randomInt(1.5));
});

test('generator respects length and character pool', () => {
  for (let i = 0; i < 500; i++) {
    const pw = generatePassword({ length: 16, classes: ALL });
    assert.equal(pw.length, 16);
    const pool = ALL.map((k) => CHARACTER_CLASSES[k]).join('');
    for (const ch of pw) assert.ok(pool.includes(ch));
  }
});

test('every selected class appears', () => {
  for (let i = 0; i < 2000; i++) {
    const pw = generatePassword({ length: 8, classes: ALL });
    assert.match(pw, /[A-Z]/);
    assert.match(pw, /[a-z]/);
    assert.match(pw, /[0-9]/);
    assert.ok([...pw].some((c) => CHARACTER_CLASSES.symbols.includes(c)));
  }
});

test('look-alikes are excluded when asked', () => {
  for (let i = 0; i < 500; i++) {
    const pw = generatePassword({ length: 32, classes: [...ALL, 'extra'], avoidLookalikes: true });
    for (const ch of pw) assert.ok(!LOOKALIKES.includes(ch), `found ${ch}`);
  }
});

test('no-repeats produces unique characters and rejects impossible lengths', () => {
  for (let i = 0; i < 300; i++) {
    const pw = generatePassword({ length: 40, classes: ALL, noRepeats: true });
    assert.equal(new Set(pw).size, 40);
  }
  assert.ok(validateOptions({ length: 11, classes: ['digits'], noRepeats: true }));
  assert.throws(() => generatePassword({ length: 11, classes: ['digits'], noRepeats: true }));
});

test('validation messages', () => {
  assert.ok(validateOptions({ length: 16, classes: [] }));
  assert.ok(validateOptions({ length: 2, classes: ALL }));
  assert.equal(validateOptions({ length: 16, classes: ALL }), null);
});

test('entropy matches brute-force count on a tiny case', () => {
  // classes: digits (10) + symbols (13), length 4, each must appear.
  // valid = 23^4 - 10^4 - 13^4 = 279841 - 10000 - 28561 = 241280
  assert.equal(countPossiblePasswords({ length: 4, classes: ['digits', 'symbols'] }), 241280n);
  // without repeats: P(23,4) - P(10,4) - P(13,4) = 212520 - 5040 - 17160 = 190320
  assert.equal(countPossiblePasswords({ length: 4, classes: ['digits', 'symbols'], noRepeats: true }), 190320n);
  // brute force check
  const pool = '0123456789' + '!@#$%^&*-_=+?';
  let n = 0;
  for (const a of pool) for (const b of pool) for (const c of pool) for (const d of pool) {
    const s = a + b + c + d;
    if (/[0-9]/.test(s) && /[^0-9]/.test(s)) n++;
  }
  assert.equal(BigInt(n), 241280n);
});

test('entropy of default 16-char password is close to 16*log2(75)', () => {
  const bits = passwordEntropyBits({ length: 16, classes: ALL });
  const naive = 16 * Math.log2(26 + 26 + 10 + 13);
  assert.ok(bits < naive && naive - bits < 1, `${bits} vs ${naive}`);
  assert.ok(bits > 98);
});

test('log2Big is accurate', () => {
  assert.equal(log2Big(1024n), 10);
  assert.ok(Math.abs(log2Big(3n ** 200n) - 200 * Math.log2(3)) < 1e-9);
});

test('resolveClasses filters look-alikes', () => {
  const sets = resolveClasses({ classes: ['digits'], avoidLookalikes: true });
  assert.equal(sets[0].chars, '23456789');
});

test('EFF wordlist is complete and unique', () => {
  assert.equal(EFF_WORDLIST.length, 7776);
  assert.equal(new Set(EFF_WORDLIST).size, 7776);
});

test('passphrase generation', () => {
  const p = generatePassphrase({ wordlist: EFF_WORDLIST, words: 6, separator: 'hyphen' });
  const parts = p.split('-');
  assert.equal(parts.length, 6);
  for (const w of parts) assert.ok(EFF_WORDLIST.includes(w));
  const q = generatePassphrase({ wordlist: EFF_WORDLIST, words: 5, separator: 'space', capitalizeWords: true, addNumber: true });
  assert.equal(q.split(' ').length, 5);
  assert.match(q, /[0-9]/);
  assert.match(q, /^[A-Z]/);
  assert.ok(Math.abs(passphraseEntropyBits({ wordlistSize: 7776, words: 6 }) - 77.55) < 0.01);
});

test('strength descriptions', () => {
  assert.equal(rate(30).key, 'weak');
  assert.equal(rate(50).key, 'fair');
  assert.equal(rate(70).key, 'strong');
  assert.equal(rate(99).key, 'very-strong');
  assert.equal(describeDuration(0.2), 'less than a second');
  assert.equal(describeDuration(90), 'about 2 minutes');
  assert.equal(describeDuration(31557600 * 2.5e6), 'about 2.5 million years');
  assert.equal(describeDuration(1e300), 'far longer than the universe has existed');
  assert.ok(averageSecondsToGuess(40) < 10);
});

test('sha1 matches known vector', async () => {
  assert.equal(await sha1Hex('password'), '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
});

test('suffix parsing handles CRLF and padding', () => {
  const body = '1E4C9B93F3F0682250B6CF8331B7EE68FD8:10434004\r\nAAAA:0\r\n';
  assert.equal(findSuffixCount(body, '1e4c9b93f3f0682250b6cf8331b7ee68fd8'), 10434004);
  assert.equal(findSuffixCount(body, 'AAAA'), 0);
  assert.equal(findSuffixCount(body, 'BBBB'), 0);
});

test('checker sends only the 5-char prefix and falls back without padding', async () => {
  const calls = [];
  let first = true;
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (first && init.headers) { first = false; throw new TypeError('CORS'); }
    return { ok: true, status: 200, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:42\r\n' };
  };
  const { check } = createChecker({ fetchImpl: fakeFetch });
  assert.equal(await check('password'), 42);
  assert.equal(await check('password'), 42); // cached
  assert.equal(calls.length, 2);
  for (const c of calls) assert.equal(c.url, 'https://api.pwnedpasswords.com/range/5BAA6');
});

test('checker reports errors instead of "clean"', async () => {
  const { check } = createChecker({ fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }) });
  await assert.rejects(check('password'), LookupError);
  const { check: check2 } = createChecker({ fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(check2('password'), LookupError);
});

test('mapLimit preserves order', async () => {
  const out = await mapLimit([3, 1, 2], 2, async (x) => { await new Promise((r) => setTimeout(r, x)); return x * 2; });
  assert.deepEqual(out, [6, 2, 4]);
});
