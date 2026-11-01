// Turns entropy into a rating and a plain-language time-to-guess.

// Assumed attacker: offline attack against a fast, unsalted hash on a
// multi-GPU rig. Deliberately pessimistic. Shown to users alongside results.
export const GUESSES_PER_SECOND = 1e11;

const SECONDS = {
  minute: 60,
  hour: 3600,
  day: 86400,
  year: 31557600, // Julian year
};

export const RATINGS = Object.freeze([
  { min: 0, key: 'weak', label: 'Weak' },
  { min: 45, key: 'fair', label: 'Fair' },
  { min: 64, key: 'strong', label: 'Strong' },
  { min: 80, key: 'very-strong', label: 'Very strong' },
]);

export function rate(bits) {
  let result = RATINGS[0];
  for (const r of RATINGS) if (bits >= r.min) result = r;
  return result;
}

/** Average seconds to guess: half the search space at the assumed rate. */
export function averageSecondsToGuess(bits, rate = GUESSES_PER_SECOND) {
  return 2 ** (bits - 1) / rate;
}

const BIG_UNITS = [
  [1e3, 'thousand'],
  [1e6, 'million'],
  [1e9, 'billion'],
  [1e12, 'trillion'],
  [1e15, 'quadrillion'],
  [1e18, 'quintillion'],
];

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** e.g. "about 3 hours", "about 40 million years". */
export function describeDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds > SECONDS.year * 1e21) {
    return 'far longer than the universe has existed';
  }
  if (seconds < 1) return 'less than a second';
  if (seconds < SECONDS.minute) return `about ${plural(Math.round(seconds), 'second')}`;
  if (seconds < SECONDS.hour) return `about ${plural(Math.round(seconds / SECONDS.minute), 'minute')}`;
  if (seconds < SECONDS.day) return `about ${plural(Math.round(seconds / SECONDS.hour), 'hour')}`;
  if (seconds < SECONDS.year) return `about ${plural(Math.round(seconds / SECONDS.day), 'day')}`;
  const years = seconds / SECONDS.year;
  if (years < 1000) return `about ${plural(Math.round(years), 'year')}`;
  // The universe is about 13.8 billion years old; beyond a sextillion
  // years the number stops meaning anything.
  if (years >= 1e21) return 'far longer than the universe has existed';
  let unit = BIG_UNITS[0];
  for (const u of BIG_UNITS) if (years >= u[0]) unit = u;
  const n = years / unit[0];
  const shown = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return `about ${shown} ${unit[1]} years`;
}

export function describeStrength(bits) {
  const rating = rate(bits);
  return {
    bits,
    rating,
    timeText: describeDuration(averageSecondsToGuess(bits)),
  };
}

// ---- Typed passwords ---------------------------------------------------------
// A typed password isn't random, so counting its characters overstates it.
// zxcvbn finds the patterns attackers try first (common passwords, words,
// names, dates, keyboard runs, l33t). Rule:
//  - zxcvbn found a pattern → use its guess count (capped by the character math).
//  - zxcvbn found nothing and it's 15+ characters → treat it as random; zxcvbn's
//    brute-force estimate (10 per character) understates that, so use the
//    character math instead. Shorter ones keep zxcvbn's conservative number:
//    a checker can't tell random from a human pattern it doesn't know
//    (e.g. "Tr0ub4dor&3"), and 15 matches current NIST guidance.

export const RANDOM_MIN_LENGTH = 15;

/** Bits if every character were picked at random from the classes it uses. */
export function charsetBits(pw) {
  const chars = [...pw];
  if (chars.length === 0) return 0;
  let pool = 0;
  if (chars.some((c) => /[a-z]/.test(c))) pool += 26;
  if (chars.some((c) => /[A-Z]/.test(c))) pool += 26;
  if (chars.some((c) => /[0-9]/.test(c))) pool += 10;
  if (chars.some((c) => /[\x20-\x7e]/.test(c) && !/[A-Za-z0-9]/.test(c))) pool += 33;
  if (chars.some((c) => c > '\x7e')) pool += 100;
  return chars.length * Math.log2(pool);
}

/**
 * Estimated bits for a typed password, given a zxcvbn result
 * ({ guessesLog10, sequence: [{ pattern }] }).
 */
export function typedPasswordBits(pw, zx) {
  const naive = charsetBits(pw);
  if (!pw) return 0;
  const patternless = zx.sequence.length > 0 && zx.sequence.every((m) => m.pattern === 'bruteforce');
  if (patternless && [...pw].length >= RANDOM_MIN_LENGTH) return naive;
  return Math.min(naive, zx.guessesLog10 * Math.log2(10));
}
