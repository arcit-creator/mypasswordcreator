// Wi-Fi keys and the "WIFI:" QR payload that phones scan to join a network.
import { generatePassword, passwordEntropyBits } from './generator.js';
import { generatePassphrase, passphraseEntropyBits } from './passphrase.js';
import { EFF_SHORT_WORDLIST } from './eff-short-wordlist.js';

// WPA2/WPA3-Personal passphrases must be 8 to 63 printable ASCII characters.
export const WPA_MIN = 8;
export const WPA_MAX = 63;

export const WIFI_STYLES = Object.freeze({
  words: { min: 6, max: 10, def: 8 },
  easy: { min: 12, max: 32, def: 16 },
  max: { min: 20, max: 63, def: 63 },
});

const EASY = { classes: ['lower', 'digits'], avoidLookalikes: true };
const MAX = { classes: ['upper', 'lower', 'digits', 'symbols'] };

/**
 * style 'words': short EFF words joined by hyphens (easy to read out or type on a TV)
 * style 'easy':  lowercase letters and digits, no look-alikes (easy on phone keyboards)
 * style 'max':   full random up to 63 characters (for devices that join by QR code)
 */
export function generateWifiKey({ style = 'words', size } = {}) {
  const s = WIFI_STYLES[style];
  if (!s) throw new Error(`Unknown style: ${style}`);
  const n = clamp(size ?? s.def, s.min, s.max);
  let key;
  if (style === 'words') {
    // Re-draw if the result falls outside WPA limits (it practically never does).
    do key = generatePassphrase({ wordlist: EFF_SHORT_WORDLIST, words: n, separator: 'hyphen' });
    while (key.length < WPA_MIN || key.length > WPA_MAX);
  } else {
    key = generatePassword({ length: n, ...(style === 'easy' ? EASY : MAX) });
  }
  return key;
}

export function wifiKeyEntropyBits({ style = 'words', size }) {
  const s = WIFI_STYLES[style];
  const n = clamp(size ?? s.def, s.min, s.max);
  if (style === 'words') return passphraseEntropyBits({ wordlistSize: EFF_SHORT_WORDLIST.length, words: n });
  return passwordEntropyBits({ length: n, ...(style === 'easy' ? EASY : MAX) });
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(n) || min)));
}

/** Escapes \ ; , : " as the WIFI: QR format requires. */
export function escapeWifiField(text) {
  return String(text).replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Builds the standard Wi-Fi QR payload understood by iOS and Android cameras.
 * security: 'WPA' (covers WPA, WPA2, WPA3-Personal) or 'nopass'.
 */
export function wifiQrPayload({ ssid, password, security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('Enter the network name.');
  let s = `WIFI:T:${security};S:${escapeWifiField(ssid)};`;
  if (security !== 'nopass') s += `P:${escapeWifiField(password)};`;
  if (hidden) s += 'H:true;';
  return s + ';';
}
