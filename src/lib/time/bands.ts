/**
 * Time bands of the rubric (product spec § 8): boundaries are inclusive, so 60
 * minutes is still SMALL and 120 minutes is still NOTICEABLE.
 */
export type Band = 'SMALL' | 'NOTICEABLE' | 'LARGE';

export const TIME_SMALL_MINUTES = 60;
export const TIME_NOTICEABLE_MINUTES = 120;

/** Signed minutes from `a` to `b` ("HH:mm" → "HH:mm"). */
export function minutesBetween(a: string, b: string): number {
  const toMinutes = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  };
  return toMinutes(b) - toMinutes(a);
}

export function timeBand(diffMinutes: number): Band {
  const abs = Math.abs(diffMinutes);
  if (abs <= TIME_SMALL_MINUTES) return 'SMALL';
  if (abs <= TIME_NOTICEABLE_MINUTES) return 'NOTICEABLE';
  return 'LARGE';
}
