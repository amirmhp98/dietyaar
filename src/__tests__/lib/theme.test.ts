import { describe, expect, it } from 'vitest';
import { resolveAppearance } from '@/lib/theme';
import { parseAppearance } from '@/lib/theme-cookie';

describe('appearance', () => {
  it('resolves system from the OS preference and explicit choices as given', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });

  it('parses the cookie defensively', () => {
    expect(parseAppearance(undefined)).toBe('system');
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('weird')).toBe('system');
  });
});
