import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, passwordEntropyBits, sanitizeSymbols, validateOptions } from '../src/core/generator.js';
import { generatePin, isWeakPin, pinEntropyBits } from '../src/core/pin.js';
import { generateWifiKey, wifiKeyEntropyBits, wifiQrPayload, escapeWifiField, WPA_MIN, WPA_MAX } from '../src/core/wifi.js';
import { EFF_SHORT_WORDLIST } from '../src/core/eff-short-wordlist.js';
import qrcode from '../src/core/qrcode.js';

test('sanitizeSymbols keeps unique printable punctuation only', () => {
  assert.equal(sanitizeSymbols('!!@ a1#€$ '), '!@#$');
  assert.equal(sanitizeSymbols(''), '');
});

test('custom symbol class only uses allowed symbols', () => {
  for (let i = 0; i < 300; i++) {
    const pw = generatePassword({ length: 20, classes: ['upper', 'lower', 'digits', 'custom'], customSymbols: '!#' });
    assert.match(pw, /^[A-Za-z0-9!#]+$/);
    assert.match(pw, /[!#]/);
  }
  assert.ok(validateOptions({ length: 16, classes: ['custom'], customSymbols: 'abc' }), 'empty after sanitising');
  const bits = passwordEntropyBits({ length: 20, classes: ['upper', 'lower', 'digits', 'custom'], customSymbols: '!#' });
  assert.ok(bits > 115 && bits < 20 * Math.log2(64));
});

test('weak PIN detection', () => {
  for (const p of ['1234', '0000', '9876', '7890', '1212', '1984', '2025', '2580', '123123', '111111', '654321', '000000'])
    assert.ok(isWeakPin(p), p);
  for (const p of ['8351', '4907', '730264', '592018']) assert.ok(!isWeakPin(p), p);
});

test('PINs have the right length and avoid weak ones', () => {
  for (let i = 0; i < 2000; i++) {
    const p = generatePin({ length: 4 });
    assert.match(p, /^\d{4}$/);
    assert.ok(!isWeakPin(p));
  }
  assert.match(generatePin({ length: 12 }), /^\d{12}$/);
  assert.throws(() => generatePin({ length: 3 }));
  const b4 = pinEntropyBits({ length: 4 });
  assert.ok(b4 < 4 * Math.log2(10) && b4 > 13, String(b4));
});

test('short wordlist is EFF short list #1', () => {
  assert.equal(EFF_SHORT_WORDLIST.length, 1296);
  assert.equal(new Set(EFF_SHORT_WORDLIST).size, 1296);
  assert.ok(EFF_SHORT_WORDLIST.every((w) => w.length <= 5));
});

test('Wi-Fi keys are valid WPA passphrases in every style', () => {
  for (const style of ['words', 'easy', 'max']) {
    for (let i = 0; i < 200; i++) {
      const k = generateWifiKey({ style });
      assert.ok(k.length >= WPA_MIN && k.length <= WPA_MAX, `${style}: ${k.length}`);
      assert.match(k, /^[\x20-\x7e]+$/);
    }
  }
  assert.equal(generateWifiKey({ style: 'max' }).length, 63);
  assert.match(generateWifiKey({ style: 'easy' }), /^[a-km-np-z2-9]+$/);
  assert.ok(wifiKeyEntropyBits({ style: 'words' }) > 70);
  assert.ok(wifiKeyEntropyBits({ style: 'max' }) > 380);
});

test('Wi-Fi QR payload escapes special characters', () => {
  assert.equal(escapeWifiField('a;b,c:d"e\\f'), 'a\\;b\\,c\\:d\\"e\\\\f');
  assert.equal(wifiQrPayload({ ssid: 'Home;Net', password: 'p:w' }), 'WIFI:T:WPA;S:Home\\;Net;P:p\\:w;;');
  assert.equal(wifiQrPayload({ ssid: 'Guest', security: 'nopass', hidden: true }), 'WIFI:T:nopass;S:Guest;H:true;;');
  assert.throws(() => wifiQrPayload({ ssid: '', password: 'x' }));
});

test('QR encoder produces a symbol for a long payload', () => {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, 'M');
  qr.addData(wifiQrPayload({ ssid: 'Café Guest 5G', password: generateWifiKey({ style: 'max' }) }));
  qr.make();
  assert.ok(qr.getModuleCount() >= 21);
});
