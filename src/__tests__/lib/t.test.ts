import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { intlTag } from '@/lib/locale';

// A tiny dictionary so the tests do not depend on real copy. The active
// locale profile still applies, so numbers render in its numerals.
vi.mock('@/messages', () => ({
  messages: {
    'greeting.plain': 'Hello',
    'greeting.named': 'Hello, {name}',
    'cart.total': '{count} of {max}',
    'items.one': '{count} item',
    'items.other': '{count} items',
  },
}));

const { t, tp } = await import('@/lib/t');

/** A number as t() renders it: the profile's digits, no grouping. */
const n = (value: number) => new Intl.NumberFormat(intlTag(), { useGrouping: false }).format(value);

// The mocked dictionary is narrower than the real one, so widen the key type once.
const T = t as unknown as (key: string, params?: Record<string, string | number>) => string;
const TP = tp as unknown as (
  base: string,
  count: number,
  params?: Record<string, string | number>,
) => string;

describe('t()', () => {
  it('returns the message text', () => {
    expect(T('greeting.plain')).toBe('Hello');
  });

  it('fills string placeholders', () => {
    expect(T('greeting.named', { name: 'Sara' })).toBe('Hello, Sara');
  });

  it('renders number placeholders in the locale numerals', () => {
    expect(T('cart.total', { count: 3, max: 10 })).toBe(`${n(3)} of ${n(10)}`);
  });

  it('leaves an unknown placeholder untouched', () => {
    expect(T('greeting.named', {})).toBe('Hello, {name}');
  });
});

describe('tp()', () => {
  it('picks the singular form', () => {
    expect(TP('items', 1)).toBe(`${n(1)} item`);
  });

  it('picks the plural form', () => {
    expect(TP('items', 5)).toBe(`${n(5)} items`);
  });
});

describe('missing keys', () => {
  const warn = vi.spyOn(console, 'warn');

  beforeEach(() => warn.mockClear().mockImplementation(() => {}));
  afterEach(() => vi.unstubAllEnvs());

  it('renders the key and warns outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(T('nope.missing')).toBe('nope.missing');
    expect(warn).toHaveBeenCalledWith('[t] missing message key "nope.missing"');
  });

  it('renders the key silently in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(T('nope.missing')).toBe('nope.missing');
    expect(warn).not.toHaveBeenCalled();
  });
});
