import { describe, it, expect } from 'vitest';
import {
  normalizeDigits,
  normalizeInput,
  normalizePersianChars,
  toLocaleDigits,
} from '@/lib/text/normalize';

describe('normalizeDigits', () => {
  it('converts Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('تلفن: ۰۹۱۲')).toBe('تلفن: 0912');
  });

  it('converts the Arabic decimal separator and drops the thousands separator', () => {
    expect(normalizeDigits('۱٬۲۳۴٫۵')).toBe('1234.5');
  });

  it('leaves ASCII untouched and accepts numbers', () => {
    expect(normalizeDigits('1234.5')).toBe('1234.5');
    expect(normalizeDigits(42)).toBe('42');
  });

  it('returns empty for nullish', () => {
    expect(normalizeDigits(null)).toBe('');
    expect(normalizeDigits(undefined)).toBe('');
  });
});

describe('toLocaleDigits', () => {
  it('converts ASCII digits to Persian for arabext', () => {
    expect(toLocaleDigits('0123456789', 'arabext')).toBe('۰۱۲۳۴۵۶۷۸۹');
    expect(toLocaleDigits(1403, 'arabext')).toBe('۱۴۰۳');
  });

  it('is a no-op for latn', () => {
    expect(toLocaleDigits('0123456789', 'latn')).toBe('0123456789');
  });

  it('leaves non-digit characters alone', () => {
    expect(toLocaleDigits('page 2 of 10', 'arabext')).toBe('page ۲ of ۱۰');
  });

  it('returns empty for nullish', () => {
    expect(toLocaleDigits(null)).toBe('');
    expect(toLocaleDigits(undefined, 'latn')).toBe('');
  });
});

describe('normalizePersianChars', () => {
  it('maps Arabic Yeh and Kaf to their Persian forms', () => {
    expect(normalizePersianChars('ي')).toBe('ی');
    expect(normalizePersianChars('ى')).toBe('ی');
    expect(normalizePersianChars('ك')).toBe('ک');
    // "كتابي" typed on an Arabic keyboard → "کتابی"
    expect(normalizePersianChars('كتابي')).toBe('کتابی');
  });

  it('removes diacritics and tatweel', () => {
    expect(normalizePersianChars('مَدرَسَه')).toBe('مدرسه');
    expect(normalizePersianChars('ســـلام')).toBe('سلام');
  });

  it('collapses repeated ZWNJ and trims edges', () => {
    expect(normalizePersianChars('می‌‌‌رود')).toBe('می‌رود');
    expect(normalizePersianChars('  ‌سلام‌ ')).toBe('سلام');
  });

  it('returns empty for nullish', () => {
    expect(normalizePersianChars(null)).toBe('');
    expect(normalizePersianChars(undefined)).toBe('');
  });
});

describe('normalizeInput', () => {
  it('normalizes digits and characters together', () => {
    expect(normalizeInput(' كد ملي: ۰۰۱۳۵۴۲۴۱۹ ')).toBe('کد ملی: 0013542419');
  });

  it('returns empty for nullish', () => {
    expect(normalizeInput(null)).toBe('');
  });
});
