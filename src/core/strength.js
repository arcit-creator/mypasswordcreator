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
