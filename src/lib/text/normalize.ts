/**
 * Text normalization for parsing copies (tech-spec.md § 9).
 *
 * Original text (plan source, meal descriptions, food names, restrictions) is
 * stored verbatim and never passed through here. These helpers produce the
 * parsing copy used for numeric fields, restriction matching and the text sent
 * to the AI: Persian and Arabic-Indic digits → ASCII, Arabic yeh/kaf → Persian
 * forms, diacritics and tatweel removed, whitespace trimmed.
 *
 * Inherited from the boilerplate's `lib/persian.ts` (removed by `--locale en`).
 * Nullish inputs return ''.
 */
import { locale, type NumberingSystem } from '@/lib/locale';

type Nullable<T> = T | null | undefined;

const PERSIAN_ZERO = 0x06f0; // ۰ … ۹ = U+06F0 … U+06F9 (Extended Arabic-Indic)
const ARABIC_ZERO = 0x0660; // ٠ … ٩ = U+0660 … U+0669 (Arabic-Indic)

/** Code point of "0" per non-Latin numbering system, for `toLocaleDigits`. */
const ZERO_BY_NUMERALS: Record<Exclude<NumberingSystem, 'latn'>, number> = {
  arabext: PERSIAN_ZERO,
};

/**
 * Persian (۰-۹) and Arabic-Indic (٠-٩) digits → ASCII, the Arabic decimal
 * separator (٫ U+066B) → '.', and the Arabic thousands separator (٬ U+066C) is
 * dropped: "۱٬۲۳۴٫۵" → "1234.5".
 */
export function normalizeDigits(input: Nullable<string | number>): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_ZERO))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}

/** ASCII digits → the numbering system's digits; a no-op for 'latn'. */
export function toLocaleDigits(
  input: Nullable<string | number>,
  numerals: NumberingSystem = locale.numerals,
): string {
  if (input === null || input === undefined) return '';
  const text = String(input);
  if (numerals === 'latn') return text;
  const zero = ZERO_BY_NUMERALS[numerals];
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(zero + Number(d)));
}

/**
 * Canonical Persian spelling for search and storage:
 * - Arabic Yeh (ي U+064A) and Alef Maksura (ى U+0649) → Persian Yeh (ی U+06CC)
 * - Arabic Kaf (ك U+0643) → Persian Kaf (ک U+06A9)
 * - Arabic diacritics (U+064B–U+065F, U+0670) and tatweel (ـ U+0640) removed
 * - runs of ZWNJ collapsed to one; ZWNJ and whitespace trimmed at both ends
 */
export function normalizePersianChars(input: Nullable<string>): string {
  if (input === null || input === undefined) return '';
  return input
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/‌{2,}/g, '‌')
    .replace(/^[\s‌]+|[\s‌]+$/g, '');
}

/** `normalizeDigits` + `normalizePersianChars`, for form values. */
export function normalizeInput(input: Nullable<string | number>): string {
  return normalizePersianChars(normalizeDigits(input));
}
