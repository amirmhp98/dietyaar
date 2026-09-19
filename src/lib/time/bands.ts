/**
 * Time bands of the rubric (product spec § 8): boundaries are inclusive, so 60
 * minutes is still SMALL and 120 minutes is still NOTICEABLE.
 */
export type Band = 'SMALL' | 'NOTICEABLE' | 'LARGE';

export const TIME_SMALL_MINUTES = 60;
export const TIME_NOTICEABLE_MINUTES = 120;

/** Signed minutes from `a` to `b` ("HH:mm" → "HH:mm") on one linear day; a total order for sorting. */
export function minutesBetween(a: string, b: string): number {
  const toMinutes = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  };
  return toMinutes(b) - toMinutes(a);
}

const DAY_MINUTES = 24 * 60;
const HALF_DAY_MINUTES = DAY_MINUTES / 2;

/**
 * Signed minutes from `a` to `b` around the clock, normalised to (−720, 720]:
 * 00:30 is 210 minutes after 21:00, not 1,230 before it. For comparing a meal
 * with a slot; not a total order, so never for sorting.
 */
export function circularMinutesBetween(a: string, b: string): number {
  const wrapped = ((minutesBetween(a, b) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return wrapped > HALF_DAY_MINUTES ? wrapped - DAY_MINUTES : wrapped;
}

export function timeBand(diffMinutes: number): Band {
  const abs = Math.abs(diffMinutes);
  if (abs <= TIME_SMALL_MINUTES) return 'SMALL';
  if (abs <= TIME_NOTICEABLE_MINUTES) return 'NOTICEABLE';
  return 'LARGE';
}
