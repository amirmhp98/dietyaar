/**
 * Locale profile — the single source of truth for language, direction,
 * calendar, numerals, time zone, week structure, and currency.
 *
 * One language per project, fixed in `FALLBACK_LOCALE` below at project
 * setup; NEXT_PUBLIC_LOCALE can still override it at build time (a way to
 * build the other profile without editing this file).
 * Nothing else in the app should ask "is this RTL?"; it reads `locale` (or a
 * field of it) instead.
 *
 * Font family is keyed off <html lang> in globals.css, so it is not part of
 * the profile.
 */

export type LocaleId = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';
export type CalendarSystem = 'persian' | 'gregory';
export type NumberingSystem = 'arabext' | 'latn';
/** 0 = Sunday … 6 = Saturday (JavaScript Date convention). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface LocaleProfile {
  id: LocaleId;
  /** <html lang> */
  lang: string;
  /** <html dir> and the root DirectionProvider */
  dir: Direction;
  /** Base BCP-47 tag for Intl APIs */
  tag: string;
  calendar: CalendarSystem;
  numerals: NumberingSystem;
  timeZone: string;
  weekStartsOn: Weekday;
  weekend: Weekday[];
  currency: {
    /** ISO 4217 code used for Intl currency formatting */
    code: string;
    /** Display unit; `divisor` converts stored minor units into it (IRR → toman = ÷10) */
    unit: 'toman' | 'rial' | 'usd';
    divisor: number;
  };
}

export const LOCALES: Record<LocaleId, LocaleProfile> = {
  fa: {
    id: 'fa',
    lang: 'fa',
    dir: 'rtl',
    tag: 'fa-IR',
    calendar: 'persian',
    numerals: 'arabext',
    timeZone: 'Asia/Tehran',
    weekStartsOn: 6,
    weekend: [5],
    currency: { code: 'IRR', unit: 'toman', divisor: 10 },
  },
  en: {
    id: 'en',
    lang: 'en',
    dir: 'ltr',
    tag: 'en-US',
    calendar: 'gregory',
    numerals: 'latn',
    timeZone: 'UTC',
    weekStartsOn: 0, // en-US convention (Sunday); use 1 for ISO/European weeks
    weekend: [0, 6],
    currency: { code: 'USD', unit: 'usd', divisor: 1 },
  },
};

/** Locale used when NEXT_PUBLIC_LOCALE is unset; fixed at project setup. */
const FALLBACK_LOCALE: LocaleId = 'en';

function resolveDefaultLocale(): LocaleId {
  const fromEnv = process.env.NEXT_PUBLIC_LOCALE;
  return fromEnv && fromEnv in LOCALES ? (fromEnv as LocaleId) : FALLBACK_LOCALE;
}

export const DEFAULT_LOCALE: LocaleId = resolveDefaultLocale();

/** The active locale profile for this deployment. */
export const locale: LocaleProfile = LOCALES[DEFAULT_LOCALE];

export const isRtl = locale.dir === 'rtl';

/**
 * Full Intl tag with calendar and numbering-system extensions,
 * e.g. `fa-IR-u-ca-persian-nu-arabext`. Pass overrides for a field that must
 * show another calendar (a Gregorian passport date inside a Persian app).
 */
export function intlTag(
  overrides: Partial<Pick<LocaleProfile, 'calendar' | 'numerals'>> = {},
  profile: LocaleProfile = locale,
): string {
  const calendar = overrides.calendar ?? profile.calendar;
  const numerals = overrides.numerals ?? profile.numerals;
  return `${profile.tag}-u-ca-${calendar}-nu-${numerals}`;
}
