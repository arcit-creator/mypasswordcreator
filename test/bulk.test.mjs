import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBulk, parseLabels, csvCell, toCsv, toTsv, startsLikeFormula, MAX_COUNT } from '../src/core/bulk.js';
import { EFF_WORDLIST } from '../src/core/eff-wordlist.js';

const PW = { length: 16, classes: ['upper', 'lower', 'digits', 'symbols'] };

test('bulk makes the requested count, all distinct', () => {
  for (const n of [1, 37, MAX_COUNT]) {
    const rows = generateBulk({ count: n, options: PW });
    assert.equal(rows.length, n);
    assert.equal(new Set(rows.map((r) => r.value)).size, n);
    for (const r of rows) assert.equal(r.value.length, 16);
  }
  assert.throws(() => generateBulk({ count: 0, options: PW }));
  assert.throws(() => generateBulk({ count: MAX_COUNT + 1, options: PW }));
  assert.throws(() => generateBulk({ count: 2.5, options: PW }));
});

test('labels set the count and pair one value per label', () => {
  const rows = generateBulk({ count: 3, labels: ['jsmith', 'front-desk'], options: PW });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.label), ['jsmith', 'front-desk']);
  assert.equal(generateBulk({ count: 4, options: PW }).every((r) => r.label === ''), true);
});

test('parseLabels trims, drops blank lines, caps at the maximum', () => {
  assert.deepEqual(parseLabels('  a \r\n\r\n b\n\nc  \r').labels, ['a', 'b', 'c']);
  assert.deepEqual(parseLabels('').labels, []);
  const many = parseLabels(Array.from({ length: MAX_COUNT + 10 }, (_, i) => `u${i}`).join('\n'));
  assert.equal(many.labels.length, MAX_COUNT);
  assert.equal(many.truncated, 10);
});

test('no bulk password starts with a formula character', () => {
  // Symbols-heavy settings make formula-leading candidates common, so this exercises the redraw.
  const opts = { length: 6, classes: ['custom', 'lower'], customSymbols: '=+-@' };
  for (let i = 0; i < 20; i++) {
    for (const r of generateBulk({ count: MAX_COUNT, options: opts })) {
      assert.ok(!startsLikeFormula(r.value), r.value);
      assert.match(r.value[0], /[a-z]/);
    }
  }
  // Only formula characters available: impossible, must fail cleanly.
  assert.throws(() => generateBulk({ count: 1, options: { length: 4, classes: ['custom'], customSymbols: '=+' } }), /start with/);
});

test('passphrase mode works and is formula-safe', () => {
  const rows = generateBulk({ kind: 'passphrase', count: 50, options: { wordlist: EFF_WORDLIST, words: 5, addNumber: true } });
  assert.equal(rows.length, 50);
  for (const r of rows) {
    assert.equal(r.value.split('-').length, 5);
    assert.ok(!startsLikeFormula(r.value));
  }
});

test('too few possible values fails instead of looping forever', () => {
  // 4 digits, no repeats: 5,040 possible values, so MAX_COUNT is fine; a 2-symbol pool is not.
  assert.equal(generateBulk({ count: MAX_COUNT, options: { length: 4, classes: ['digits'], noRepeats: true } }).length, MAX_COUNT);
  assert.throws(() => generateBulk({ count: 100, options: { length: 4, classes: ['custom'], customSymbols: '!#' } }), /different/);
});

test('csvCell quotes, doubles quotes, and neutralises formulas', () => {
  assert.equal(csvCell('abc'), '"abc"');
  assert.equal(csvCell('a"b,c'), '"a""b,c"');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  for (const lead of ['=', '+', '-', '@', '\t', '\r']) assert.equal(csvCell(`${lead}SUM(A1)`)[1], "'");
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});

test('toCsv: header, label column only when used, CRLF', () => {
  const plain = toCsv([{ label: '', value: 'p1' }, { label: '', value: 'p"2' }]);
  assert.equal(plain, '"Password"\r\n"p1"\r\n"p""2"\r\n');
  const labeled = toCsv([{ label: '=cmd|calc', value: 'x' }, { label: 'bob', value: 'y' }], { valueHeader: 'Passphrase' });
  assert.equal(labeled, `"Label","Passphrase"\r\n"'=cmd|calc","x"\r\n"bob","y"\r\n`);
});

test('toTsv keeps rows on one line and neutralises formulas', () => {
  assert.equal(toTsv([{ label: 'a\tb', value: 'v1' }, { label: '@x', value: 'v2' }]), "a b\tv1\r\n'@x\tv2");
  assert.equal(toTsv([{ label: '', value: 'v1' }]), 'v1');
});
