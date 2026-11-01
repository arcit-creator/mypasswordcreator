import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charsetBits, typedPasswordBits, describeStrength } from '../src/core/strength.js';
import { createZxcvbn } from '../src/core/zxcvbn.js';

const zxcvbn = createZxcvbn();
const rateTyped = (pw) => describeStrength(typedPasswordBits(pw, zxcvbn.check(pw))).rating.key;

test('charsetBits counts the classes a password uses', () => {
  assert.equal(charsetBits(''), 0);
  assert.equal(charsetBits('aaaa'), 4 * Math.log2(26));
  assert.equal(charsetBits('aA1!'), 4 * Math.log2(95));
});

test('predictable passwords rate weak even when they look complex', () => {
  for (const pw of ['password1', 'Summer2026!', 'P@ssw0rd!', 'qwerty123', 'Tr0ub4dor&3', 'iloveyou2024']) {
    assert.equal(rateTyped(pw), 'weak', pw);
  }
});

test('short patternless passwords stay conservative', () => {
  const pw = 'kT7#qW2m'; // 8 characters: no credit as "random"
  assert.equal(rateTyped(pw), 'weak');
});

test('random-looking passwords keep their full character-set strength', () => {
  const pw = 'xK9#mQ2v!pL7zR4w'; // 16 random characters
  assert.equal(typedPasswordBits(pw, zxcvbn.check(pw)), charsetBits(pw));
  assert.equal(rateTyped(pw), 'very-strong');
});

test('a long multi-word passphrase rates strong or better', () => {
  assert.ok(['strong', 'very-strong'].includes(rateTyped('correct horse battery staple')));
});

test('a found pattern never rates higher than the character-set math', () => {
  const pw = 'Summer2026!';
  assert.ok(typedPasswordBits(pw, zxcvbn.check(pw)) <= charsetBits(pw));
});

test('feedback flags common passwords', () => {
  assert.match(zxcvbn.check('password1').feedback.warning, /common/i);
});
