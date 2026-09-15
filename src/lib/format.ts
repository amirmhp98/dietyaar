/**
 * Locale-aware formatting built on Intl only — no date/number libraries.
 *
 * Every function reads its defaults from the active `locale` profile and
 * accepts an optional options object that can override `profile`, `calendar`,
 * `numerals` and `timeZone` for that one call, e.g. a Gregorian passport date
 * inside a Persian app: `formatDate(d, { calendar: 'gregory' })`. Any other
 * key is passed straight through to the underlying Intl constructor.
 *
 * Nullish inputs (`null` / `undefined`) and NaN return '' — never '0' — so a
 * missing value renders as empty rather than as a misleading zero. `0` itself
 * still renders as "۰" / "0".
 *
 * Intl instances are expensive to construct, so each kind is cached per
 * option signature.
 */
import {
  intlTag,
  locale,
  type CalendarSystem,
  type LocaleId,
  type LocaleProfile,
  type NumberingSystem,
} from '@/lib/locale';

type Nullable<T> = T | null | undefined;

/** Accepted date inputs: Date, epoch milliseconds, or an ISO-8601 string. */
export type DateInput = Date | number | string;

export interface FormatOptions {
  /** Target profile; defaults to the active `locale`. Tests pass `LOCALES.en`. */
  profile?: LocaleProfile;
  calendar?: CalendarSystem;
  numerals?: NumberingSystem;
  /** IANA time zone; defaults to the profile's `timeZone`. Dates only. */
  timeZone?: string;
}

export type NumberFormatOptions = FormatOptions & Intl.NumberFormatOptions;
export type DateFormatOptions = FormatOptions & Intl.DateTimeFormatOptions;
export type RelativeFormatOptions = FormatOptions &
  Intl.RelativeTimeFormatOptions & {
    /** Reference instant; defaults to `Date.now()`. Pass it in tests. */
    now?: DateInput;
  };
export type ListFormatOptions = FormatOptions & Intl.ListFormatOptions;
export type PluralOptions = FormatOptions & Intl.PluralRulesOptions;
export type CollatorOptions = FormatOptions & Intl.CollatorOptions;

/** Plural forms keyed by CLDR category; `other` is the required fallback. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

// ---------------------------------------------------------------------------
// Option resolution and Intl instance cache
// ---------------------------------------------------------------------------

function resolve<T extends FormatOptions>(opts: T) {
  const { profile = locale, calendar, numerals, timeZone, ...intl } = opts;
  return {
    profile,
    tag: intlTag({ calendar, numerals }, profile),
    timeZone: timeZone ?? profile.timeZone,
    intl,
  };
}

/** Only the profile-level fields, for delegating to another formatter. */
function baseOptions(opts: FormatOptions): FormatOptions {
  const { profile, calendar, numerals, timeZone } = opts;
  return { profile, calendar, numerals, timeZone };
}

const caches = {
  number: new Map<string, Intl.NumberFormat>(),
  date: new Map<string, Intl.DateTimeFormat>(),
  relative: new Map<string, Intl.RelativeTimeFormat>(),
  list: new Map<string, Intl.ListFormat>(),
  plural: new Map<string, Intl.PluralRules>(),
  collator: new Map<string, Intl.Collator>(),
};

function cached<T>(cache: Map<string, T>, tag: string, options: object, create: () => T): T {
  const key = `${tag}|${JSON.stringify(options)}`;
  let instance = cache.get(key);
  if (!instance) {
    instance = create();
    cache.set(key, instance);
  }
  return instance;
}

function numberFormatter(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(caches.number, tag, options, () => new Intl.NumberFormat(tag, options));
}

function dateFormatter(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(caches.date, tag, options, () => new Intl.DateTimeFormat(tag, options));
}

function relativeFormatter(
  tag: string,
  options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  return cached(caches.relative, tag, options, () => new Intl.RelativeTimeFormat(tag, options));
}

function listFormatter(tag: string, options: Intl.ListFormatOptions): Intl.ListFormat {
  return cached(caches.list, tag, options, () => new Intl.ListFormat(tag, options));
}

function pluralRules(tag: string, options: Intl.PluralRulesOptions): Intl.PluralRules {
  return cached(caches.plural, tag, options, () => new Intl.PluralRules(tag, options));
}

function collator(tag: string, options: Intl.CollatorOptions): Intl.Collator {
  return cached(caches.collator, tag, options, () => new Intl.Collator(tag, options));
}

function isMissingNumber(value: Nullable<number>): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

function toDate(input: Nullable<DateInput>): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function formatNumber(value: Nullable<number>, opts: NumberFormatOptions = {}): string {
  if (isMissingNumber(value)) return '';
  const { tag, intl } = resolve(opts);
  return numberFormatter(tag, intl).format(value);
}

/**
 * Compact notation for social-style metrics, keeping the legacy k/m suffixes:
 * - < 1,000 → plain number (۸۴۲ / 842)
 * - 1,000 – 999,999 → up to one decimal + "k" (۵۴٫۴k / 54.4k)
 * - ≥ 1,000,000 → up to two decimals + "m" (۱٫۳۴m / 1.34m)
 * Digits follow the profile's numerals; the suffix is always Latin.
 */
export function formatCompactNumber(
  value: Nullable<number>,
  opts: NumberFormatOptions = {},
): string {
  if (isMissingNumber(value)) return '';
  const abs = Math.abs(value);
  if (abs < 1_000) return formatNumber(value, opts);
  const [scaled, suffix, maximumFractionDigits] =
    abs < 1_000_000 ? [value / 1_000, 'k', 1] : [value / 1_000_000, 'm', 2];
  return `${formatNumber(scaled, { maximumFractionDigits, ...opts })}${suffix}`;
}

/** `value` is a ratio: 0.123 → "۱۲٪" / "12%". Pass `maximumFractionDigits` for decimals. */
export function formatPercent(value: Nullable<number>, opts: NumberFormatOptions = {}): string {
  if (isMissingNumber(value)) return '';
  const { tag, intl } = resolve(opts);
  return numberFormatter(tag, { style: 'percent', ...intl }).format(value);
}

// TODO(messages): move these unit labels into the messages module once it exists.
const CURRENCY_UNIT_LABELS: Record<LocaleId, Record<'toman' | 'rial', string>> = {
  fa: { toman: 'تومان', rial: 'ریال' },
  en: { toman: 'Toman', rial: 'Rial' },
};

/**
 * Formats an amount stored in minor units (IRR for the fa profile) using the
 * profile's currency: the value is divided by `currency.divisor`, then
 * - toman / rial → number followed by the unit label, whole units by default
 *   (override with `maximumFractionDigits`);
 * - usd → Intl currency style ("$1,234.50").
 */
export function formatCurrency(
  minorUnits: Nullable<number>,
  opts: NumberFormatOptions = {},
): string {
  if (isMissingNumber(minorUnits)) return '';
  const { profile, tag, intl } = resolve(opts);
  const { code, unit, divisor } = profile.currency;
  const amount = minorUnits / divisor;
  if (unit === 'usd') {
    return numberFormatter(tag, { style: 'currency', currency: code, ...intl }).format(amount);
  }
  const number = numberFormatter(tag, { maximumFractionDigits: 0, ...intl }).format(amount);
  return `${number} ${CURRENCY_UNIT_LABELS[profile.id][unit]}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE_COMPONENT_KEYS = [
  'weekday',
  'era',
  'year',
  'month',
  'day',
  'dayPeriod',
  'hour',
  'minute',
  'second',
  'fractionalSecondDigits',
  'timeZoneName',
] as const;

/** Intl throws when `dateStyle`/`timeStyle` are mixed with component fields. */
function hasDateComponents(options: Intl.DateTimeFormatOptions): boolean {
  return DATE_COMPONENT_KEYS.some((key) => options[key] !== undefined);
}

function formatDateWith(
  defaults: Intl.DateTimeFormatOptions,
  input: Nullable<DateInput>,
  opts: DateFormatOptions,
): string {
  const date = toDate(input);
  if (!date) return '';
  const { tag, timeZone, intl } = resolve(opts);
  const options = { ...(hasDateComponents(intl) ? {} : defaults), ...intl, timeZone };
  return dateFormatter(tag, options).format(date);
}

/** Date only, `dateStyle: 'medium'` by default ("۱ فروردین ۱۴۰۴" / "Mar 21, 2025"). */
export function formatDate(date: Nullable<DateInput>, opts: DateFormatOptions = {}): string {
  return formatDateWith({ dateStyle: 'medium' }, date, opts);
}

/** Date and time, medium date + short time by default. */
export function formatDateTime(date: Nullable<DateInput>, opts: DateFormatOptions = {}): string {
  return formatDateWith({ dateStyle: 'medium', timeStyle: 'short' }, date, opts);
}

/** Time only, `timeStyle: 'short'` by default ("۱۵:۳۰" / "12:00 PM"). */
export function formatTime(date: Nullable<DateInput>, opts: DateFormatOptions = {}): string {
  return formatDateWith({ timeStyle: 'short' }, date, opts);
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Largest unit first; the last entry is the fallback for sub-minute spans. */
const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
  ['second', SECOND],
];

/**
 * "دیروز" / "yesterday", "۳ ساعت پیش" / "3 hours ago", "in 2 weeks" …
 * The unit is picked automatically from the elapsed time and `numeric: 'auto'`
 * yields words for 0/±1 where the language has them.
 */
export function formatRelative(
  date: Nullable<DateInput>,
  opts: RelativeFormatOptions = {},
): string {
  const target = toDate(date);
  if (!target) return '';
  const { now = Date.now(), ...rest } = opts;
  const base = toDate(now);
  if (!base) return '';
  const { tag, intl } = resolve(rest);
  const diff = target.getTime() - base.getTime();
  const abs = Math.abs(diff);
  const [unit, size] =
    RELATIVE_UNITS.find(([, ms]) => abs >= ms) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  const value = Math.round(diff / size) || 0; // `|| 0` folds -0 into 0 → "now"
  return relativeFormatter(tag, { numeric: 'auto', ...intl }).format(value, unit);
}

// ---------------------------------------------------------------------------
// Lists, plurals, collation
// ---------------------------------------------------------------------------

/** "الف، ب، و پ" / "a, b, and c". Pass `type: 'disjunction'` for "or". */
export function formatList(
  items: Nullable<readonly string[]>,
  opts: ListFormatOptions = {},
): string {
  if (!items || items.length === 0) return '';
  const { tag, intl } = resolve(opts);
  return listFormatter(tag, intl).format(items);
}

/**
 * Picks the form for `count` via Intl.PluralRules and substitutes `{count}`
 * with the locale-formatted number. Note Persian puts 0 in the `one` category.
 */
export function plural(
  count: Nullable<number>,
  forms: PluralForms,
  opts: PluralOptions = {},
): string {
  if (isMissingNumber(count)) return '';
  const { tag, intl } = resolve(opts);
  const form = forms[pluralRules(tag, intl).select(count)] ?? forms.other;
  return form.replace('{count}', formatNumber(count, baseOptions(opts)));
}

/** Locale-aware string comparison (`numeric: true` by default so "2" < "10"). */
export function compare(
  a: Nullable<string>,
  b: Nullable<string>,
  opts: CollatorOptions = {},
): number {
  const { tag, intl } = resolve(opts);
  return collator(tag, { numeric: true, ...intl }).compare(a ?? '', b ?? '');
}

/** Returns a new array sorted by `pick(item)` with the profile's collation. */
export function sortBy<T>(
  items: readonly T[],
  pick: (item: T) => Nullable<string>,
  opts: CollatorOptions = {},
): T[] {
  const { tag, intl } = resolve(opts);
  const { compare: cmp } = collator(tag, { numeric: true, ...intl });
  return [...items].sort((x, y) => cmp(pick(x) ?? '', pick(y) ?? ''));
}
