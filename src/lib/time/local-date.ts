import { TZDate } from '@date-fns/tz';

/**
 * Zone-aware calendar helpers. Every function takes the instant and the IANA
 * zone explicitly (decision 009): nothing here reads a default zone.
 * Local dates are ISO strings ("2026-09-17"), local times "HH:mm".
 */

export type LocalDate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsCache.set(zone, f);
  }
  return f;
}

function zonedParts(instant: Date, zone: string) {
  const parts = formatter(zone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function isValidLocalDate(value: string): value is LocalDate {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** True when `zone` is an IANA zone this runtime can format with. */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of `instant` in `zone`, as "YYYY-MM-DD". */
export function localDateFor(instant: Date, zone: string): LocalDate {
  const { year, month, day } = zonedParts(instant, zone);
  return `${year}-${month}-${day}`;
}

/** The wall-clock time of `instant` in `zone`, as "HH:mm". */
export function localTimeFor(instant: Date, zone: string): string {
  const { hour, minute } = zonedParts(instant, zone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Start (inclusive) and end (exclusive) instants of a local calendar day. */
export function dayBounds(localDate: LocalDate, zone: string): { start: Date; end: Date } {
  const [y, m, d] = localDate.split('-').map(Number);
  const start = new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, zone).getTime());
  const end = new Date(new TZDate(y, m - 1, d + 1, 0, 0, 0, 0, zone).getTime());
  return { start, end };
}

/** The instant of `localDate` + `time` in `zone`. */
export function instantFor(localDate: LocalDate, time: string, zone: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, zone).getTime());
}

/** 00:00–03:59 local: the composer asks "Was this for yesterday?". */
export function isLateNightWindow(now: Date, zone: string): boolean {
  return zonedParts(now, zone).hour < 4;
}

/** 0 = Sunday … 6 = Saturday. A calendar date's weekday does not depend on a zone. */
export function weekdayOf(localDate: LocalDate): number {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(localDate: LocalDate, days: number): LocalDate {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Inclusive list of dates from `start` to `end`. */
export function dateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Signed day difference `b - a`. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const toUtc = (v: LocalDate) => {
    const [y, m, d] = v.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** The anchored week (start inclusive, end inclusive) containing `localDate`. */
export function weekBounds(
  localDate: LocalDate,
  weekStart: number,
): { start: LocalDate; end: LocalDate } {
  const offset = (weekdayOf(localDate) - weekStart + 7) % 7;
  const start = addDays(localDate, -offset);
  return { start, end: addDays(start, 6) };
}

/**
 * A meal cannot be eaten in the future: a date after today in `zone`, or
 * today with a time after `now`. A future date with unknown time is future.
 */
export function isFutureLocalDateTime(
  localDate: LocalDate,
  time: string | null,
  now: Date,
  zone: string,
): boolean {
  const today = localDateFor(now, zone);
  if (localDate > today) return true;
  if (localDate < today || time === null) return false;
  return instantFor(localDate, time, zone).getTime() > now.getTime();
}
