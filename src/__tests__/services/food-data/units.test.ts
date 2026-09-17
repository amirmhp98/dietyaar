import { describe, expect, it } from 'vitest';
import {
  ASSUMED_DEFAULTS,
  UNITS,
  convert,
  toGrams,
  unitTableText,
} from '@/services/food-data/units';

describe('unit table', () => {
  it('carries the product-spec § 6 rows with a source note', () => {
    const glass = UNITS.find((u) => u.key === 'glass');
    expect(glass?.ml).toBe(240);
    expect(UNITS.find((u) => u.key === 'cup')?.ml).toBe(200);
    expect(UNITS.find((u) => u.key === 'tsp')?.ml).toBe(5);
    expect(UNITS.find((u) => u.key === 'tbsp')?.ml).toBe(15);
    expect(UNITS.find((u) => u.key === 'medium_apple')?.grams).toBe(180);
    expect(UNITS.find((u) => u.key === 'small_banana')?.grams).toBe(100);
    expect(UNITS.find((u) => u.key === 'date')?.grams).toBe(8);
    expect(UNITS.find((u) => u.key === 'slice_sangak')?.grams).toBe(80);
    expect(UNITS.every((u) => u.source.length > 0)).toBe(true);
    expect(ASSUMED_DEFAULTS.cucumber_tomato.quantity).toBe(150);
    expect(ASSUMED_DEFAULTS.large_salad.quantity).toBe(200);
  });

  it('converts within a kind and through count units', () => {
    expect(convert(2, 'slice_sangak', 'g')).toBe(160);
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(1, 'glass', 'ml')).toBe(240);
    expect(convert(3, 'tsp', 'tbsp')).toBe(1);
    expect(toGrams(160, 'g')).toBe(160);
  });

  it('refuses unknown pairs (mass ↔ volume without density, unknown units)', () => {
    expect(convert(1, 'glass', 'g')).toBeNull();
    expect(convert(1, 'glass', 'g', 1.03)).toBeCloseTo(247.2);
    expect(convert(1, 'piece', 'g')).toBeNull();
    expect(convert(1, 'fistful', 'g')).toBeNull();
  });

  it('renders as text for prompts', () => {
    expect(unitTableText()).toContain('glass: glass = 240 ml');
  });
});
