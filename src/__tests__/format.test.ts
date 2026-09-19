import { afterEach, describe, it, expect } from 'vitest';
import { LOCALES, locale } from '@/lib/locale';
import {
  compare,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatList,
  formatLocalDate,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  plural,
  sortBy,
} from '@/lib/format';

const fa = { profile: LOCALES.fa };
const en = { profile: LOCALES.en };

/** 2025-03-21 12:00 UTC = ۱ فروردین ۱۴۰۴، ۱۵:۳۰ in Asia/Tehran. */
const NOWRUZ = new Date('2025-03-21T12:00:00Z');
const PERSIAN_DIGITS = /[۰-۹]/;

describe('formatNumber', () => {
  it('uses Persian digits and separators for fa', () => {
    expect(formatNumber(1234567.89, fa)).toBe('۱٬۲۳۴٬۵۶۷٫۸۹');
  });

  it('uses Latin digits and separators for en', () => {
    expect(formatNumber(1234567.89, en)).toBe('1,234,567.89');
  });

  it('can override numerals for a single call', () => {
    expect(formatNumber(1234567.89, { ...fa, numerals: 'latn' })).toMatch(/^1\D234\D567\D89$/);
    expect(formatNumber(42, { ...en, numerals: 'arabext' })).toBe('۴۲');
  });

  it('defaults to the active locale profile', () => {
    expect(formatNumber(1234)).toBe(formatNumber(1234, { profile: locale }));
  });

  it('renders zero but not nullish or NaN', () => {
    expect(formatNumber(0, fa)).toBe('۰');
    expect(formatNumber(0, en)).toBe('0');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber(Number.NaN)).toBe('');
  });

  it('passes Intl options through', () => {
    expect(formatNumber(3.14159, { ...en, maximumFractionDigits: 2 })).toBe('3.14');
  });
});

describe('formatCompactNumber', () => {
  it('keeps the k/m suffix behaviour with profile digits', () => {
    expect(formatCompactNumber(842, fa)).toBe('۸۴۲');
    expect(formatCompactNumber(54_400, fa)).toBe('۵۴٫۴k');
    expect(formatCompactNumber(1_340_000, fa)).toBe('۱٫۳۴m');
    expect(formatCompactNumber(999, en)).toBe('999');
    expect(formatCompactNumber(1_000, en)).toBe('1k');
    expect(formatCompactNumber(54_400, en)).toBe('54.4k');
    expect(formatCompactNumber(1_000_000, en)).toBe('1m');
    expect(formatCompactNumber(1_340_000, en)).toBe('1.34m');
  });

  it('returns empty for nullish', () => {
    expect(formatCompactNumber(null)).toBe('');
    expect(formatCompactNumber(undefined)).toBe('');
  });
});

describe('formatPercent', () => {
  it('formats a ratio as a percentage', () => {
    expect(formatPercent(0.123, fa)).toBe('۱۲٪');
    expect(formatPercent(0.123, en)).toBe('12%');
    expect(formatPercent(0.123, { ...en, maximumFractionDigits: 1 })).toBe('12.3%');
    expect(formatPercent(null)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('renders toman from stored rial minor units for fa', () => {
    expect(formatCurrency(12_340, fa)).toBe('۱٬۲۳۴ تومان');
    expect(formatCurrency(5_000, { ...fa, numerals: 'latn' })).toBe('500 تومان');
  });

  it('renders rial when the profile unit is rial', () => {
    const rial = {
      profile: { ...LOCALES.fa, currency: { code: 'IRR', unit: 'rial' as const, divisor: 1 } },
    };
    expect(formatCurrency(12_340, rial)).toBe('۱۲٬۳۴۰ ریال');
  });

  it('uses Intl currency style for usd', () => {
    expect(formatCurrency(1234.5, en)).toBe('$1,234.50');
  });

  it('returns empty for nullish', () => {
    expect(formatCurrency(null)).toBe('');
    expect(formatCurrency(undefined)).toBe('');
  });
});

describe('formatDate / formatDateTime / formatTime', () => {
  it('uses the Persian calendar, digits and Tehran time zone for fa', () => {
    expect(formatDate(NOWRUZ, fa)).toBe('۱ فروردین ۱۴۰۴');
    expect(formatDateTime(NOWRUZ, fa)).toBe('۱ فروردین ۱۴۰۴، ۱۵:۳۰');
    expect(formatTime(NOWRUZ, fa)).toBe('۱۵:۳۰');
  });

  it('uses the Gregorian calendar, Latin digits and UTC for en', () => {
    expect(formatDate(NOWRUZ, en)).toBe('Mar 21, 2025');
    expect(formatDateTime(NOWRUZ, en)).toBe('Mar 21, 2025, 12:00 PM');
    expect(formatTime(NOWRUZ, en)).toBe('12:00 PM');
  });

  it('can override calendar, numerals and time zone per call', () => {
    expect(formatDate(NOWRUZ, { ...fa, calendar: 'gregory' })).toBe('۲۱ مارس ۲۰۲۵');
    expect(formatDate(NOWRUZ, { ...fa, calendar: 'gregory', numerals: 'latn' })).toBe(
      '21 مارس 2025',
    );
    expect(formatDate(NOWRUZ, { ...en, calendar: 'persian' })).toContain('1404');
    expect(formatTime(NOWRUZ, { ...en, timeZone: 'Asia/Tehran' })).toBe('3:30 PM');
  });

  it('drops the default dateStyle when component fields are given', () => {
    expect(formatDate(NOWRUZ, { ...en, year: 'numeric', month: 'long' })).toBe('March 2025');
  });

  it('accepts timestamps and ISO strings', () => {
    expect(formatDate(NOWRUZ.getTime(), en)).toBe('Mar 21, 2025');
    expect(formatDate('2025-03-21T12:00:00Z', en)).toBe('Mar 21, 2025');
  });
});

describe('formatLocalDate', () => {
  const processZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = processZone;
  });

  it('formats a "YYYY-MM-DD" day as that day whatever the process zone', () => {
    for (const zone of ['Asia/Tehran', 'Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = zone;
      expect(formatLocalDate('2026-09-19', en)).toBe('Sep 19, 2026');
      expect(formatLocalDate('2026-09-19', { ...en, month: 'short', day: 'numeric' })).toBe(
        'Sep 19',
      );
    }
    // The shape this replaces: "T00:00:00" parses as process-local midnight, a day earlier in UTC.
    process.env.TZ = 'Asia/Tehran';
    expect(formatDate('2026-09-19T00:00:00', { ...en, timeZone: 'UTC' })).toBe('Sep 18, 2026');
    expect(formatLocalDate('2026-01-01', { ...en, timeZone: 'Pacific/Kiritimati' })).toBe(
      'Jan 1, 2026',
    );
    expect(formatLocalDate('2025-03-21', fa)).toBe('۱ فروردین ۱۴۰۴');
  });

  it('returns empty for nullish or malformed input', () => {
    expect(formatLocalDate(null)).toBe('');
    expect(formatLocalDate(undefined)).toBe('');
    expect(formatLocalDate('2026-9-1')).toBe('');
    expect(formatLocalDate('2026-09-19T00:00:00')).toBe('');
  });

  it('returns empty for nullish or invalid dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not a date')).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });
});

describe('formatRelative', () => {
  const shift = (ms: number) => new Date(NOWRUZ.getTime() + ms);
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  it('picks the unit automatically and uses words for ±1', () => {
    expect(formatRelative(shift(-DAY), { ...fa, now: NOWRUZ })).toBe('دیروز');
    expect(formatRelative(shift(-DAY), { ...en, now: NOWRUZ })).toBe('yesterday');
    expect(formatRelative(shift(DAY), { ...fa, now: NOWRUZ })).toBe('فردا');
    expect(formatRelative(shift(DAY), { ...en, now: NOWRUZ })).toBe('tomorrow');
    expect(formatRelative(shift(-3 * HOUR), { ...fa, now: NOWRUZ })).toBe('۳ ساعت پیش');
    expect(formatRelative(shift(-3 * HOUR), { ...en, now: NOWRUZ })).toBe('3 hours ago');
    expect(formatRelative(shift(-30_000), { ...en, now: NOWRUZ })).toBe('30 seconds ago');
    expect(formatRelative(shift(14 * DAY), { ...en, now: NOWRUZ })).toBe('in 2 weeks');
    expect(formatRelative(shift(-70 * DAY), { ...en, now: NOWRUZ })).toBe('2 months ago');
    expect(formatRelative(shift(5 * 365 * DAY), { ...en, now: NOWRUZ })).toBe('in 5 years');
  });

  it('says "now" for the same instant', () => {
    expect(formatRelative(NOWRUZ, { ...fa, now: NOWRUZ })).toBe('اکنون');
    expect(formatRelative(NOWRUZ, { ...en, now: NOWRUZ })).toBe('now');
    expect(formatRelative(shift(-400), { ...en, now: NOWRUZ })).toBe('now');
  });

  it('returns empty for nullish', () => {
    expect(formatRelative(null)).toBe('');
    expect(formatRelative(undefined)).toBe('');
  });
});

describe('formatList', () => {
  it('joins with the locale conjunction', () => {
    expect(formatList(['الف', 'ب', 'پ'], fa)).toContain(' و پ');
    expect(formatList(['الف', 'ب', 'پ'], fa)).not.toMatch(/and/);
    expect(formatList(['a', 'b', 'c'], en)).toBe('a, b, and c');
    expect(formatList(['a', 'b', 'c'], { ...en, type: 'disjunction' })).toBe('a, b, or c');
  });

  it('returns empty for nullish or empty lists', () => {
    expect(formatList([])).toBe('');
    expect(formatList(null)).toBe('');
    expect(formatList(undefined)).toBe('');
  });
});

describe('plural', () => {
  const enForms = { one: '{count} item', other: '{count} items' };
  const faForms = { one: '{count} مورد', other: '{count} مورد‌ها' };

  it('selects the CLDR category per locale', () => {
    expect(plural(1, enForms, en)).toBe('1 item');
    expect(plural(2, enForms, en)).toBe('2 items');
    expect(plural(0, enForms, en)).toBe('0 items');
    // Persian puts 0 and 1 in "one".
    expect(plural(0, faForms, fa)).toBe('۰ مورد');
    expect(plural(3, faForms, fa)).toBe('۳ مورد‌ها');
  });

  it('falls back to "other" when a form is missing and returns empty for nullish', () => {
    expect(plural(1, { other: 'things' }, en)).toBe('things');
    expect(plural(null, enForms)).toBe('');
  });
});

describe('compare / sortBy', () => {
  it('sorts Persian letters in alphabet order', () => {
    expect(sortBy(['پ', 'ب', 'الف'], (s) => s, fa)).toEqual(['الف', 'ب', 'پ']);
  });

  it('sorts numerically by default', () => {
    expect(sortBy(['item10', 'item2', 'item1'], (s) => s, en)).toEqual([
      'item1',
      'item2',
      'item10',
    ]);
    expect(compare('item2', 'item10', en)).toBeLessThan(0);
    expect(compare('a', 'a', en)).toBe(0);
  });

  it('treats nullish keys as empty strings and does not mutate the input', () => {
    const input = [{ n: 'b' }, { n: null }, { n: 'a' }];
    expect(sortBy(input, (x) => x.n, en).map((x) => x.n)).toEqual([null, 'a', 'b']);
    expect(input.map((x) => x.n)).toEqual(['b', null, 'a']);
    expect(compare(null, '', en)).toBe(0);
  });
});

describe('profile digits', () => {
  it('fa outputs contain Persian digits and en outputs do not', () => {
    for (const out of [formatNumber(5, fa), formatDate(NOWRUZ, fa), formatCurrency(50, fa)]) {
      expect(out).toMatch(PERSIAN_DIGITS);
    }
    for (const out of [formatNumber(5, en), formatDate(NOWRUZ, en), formatCurrency(50, en)]) {
      expect(out).not.toMatch(PERSIAN_DIGITS);
    }
  });
});
