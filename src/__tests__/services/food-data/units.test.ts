import { describe, expect, it } from 'vitest';
import {
  ASSUMED_DEFAULTS,
  FOOD_WEIGHT_HINTS,
  UNITS,
  convert,
  foodWeightHintsText,
  formatAmount,
  isCountUnit,
  legacyUnit,
  portionAmount,
  resolveUnitGrams,
  toGrams,
  unitLabel,
  unitTableText,
  withLegacyUnit,
} from '@/services/food-data/units';

describe('unit table (decision 024)', () => {
  it('is measures only: mass, volume and count units with no weight of their own', () => {
    expect(UNITS.map((u) => u.key)).toEqual([
      'g',
      'kg',
      'ml',
      'l',
      'glass',
      'cup',
      'tsp',
      'tbsp',
      'bowl',
      'piece',
      'slice',
      'sheet',
      'skewer',
      'handful',
      'serving',
    ]);
    expect(UNITS.find((u) => u.key === 'glass')?.ml).toBe(240);
    expect(UNITS.find((u) => u.key === 'cup')?.ml).toBe(200);
    expect(UNITS.find((u) => u.key === 'tsp')?.ml).toBe(5);
    expect(UNITS.find((u) => u.key === 'tbsp')?.ml).toBe(15);
    expect(UNITS.filter((u) => u.kind === 'count').every((u) => u.grams === undefined)).toBe(true);
    expect(UNITS.every((u) => u.source.length > 0)).toBe(true);
    expect(isCountUnit('piece')).toBe(true);
    expect(isCountUnit('g')).toBe(false);
    expect(isCountUnit('fistful')).toBe(false);
    expect(ASSUMED_DEFAULTS.cucumber_tomato.quantity).toBe(150);
    expect(ASSUMED_DEFAULTS.large_salad.quantity).toBe(200);
  });

  it('keeps the old per-food weights as hints for the AI, with a source note', () => {
    const hint = (label: string) => FOOD_WEIGHT_HINTS.find((h) => h.label === label)?.grams;
    expect(hint('medium apple')).toBe(180);
    expect(hint('small banana')).toBe(100);
    expect(hint('date (fruit)')).toBe(8);
    expect(hint('slice of sangak')).toBe(80);
    expect(hint('egg')).toBe(50);
    expect(hint('walnut kernel')).toBe(4);
    expect(FOOD_WEIGHT_HINTS.every((h) => h.source.length > 0)).toBe(true);
    expect(foodWeightHintsText()).toContain('medium apple ≈ 180 g');
  });

  it('converts within a kind, and count units through the grams of one', () => {
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(1, 'glass', 'ml')).toBe(240);
    expect(convert(3, 'tsp', 'tbsp')).toBe(1);
    expect(toGrams(160, 'g')).toBe(160);
    expect(toGrams(2, 'slice', { unitGrams: 80 })).toBe(160);
    expect(convert(2, 'piece', 'g', { unitGrams: 180 })).toBe(360);
    expect(convert(360, 'g', 'piece', { unitGrams: 180 })).toBe(2);
    expect(convert(2, 'piece', 'piece')).toBe(2);
  });

  it('refuses unknown pairs (mass ↔ volume without density, counts without grams, unknown units)', () => {
    expect(convert(1, 'glass', 'g')).toBeNull();
    expect(convert(1, 'glass', 'g', { density: 1.03 })).toBeCloseTo(247.2);
    expect(convert(1, 'piece', 'g')).toBeNull();
    expect(convert(1, 'piece', 'g', { unitGrams: null })).toBeNull();
    expect(convert(1, 'piece', 'slice', { unitGrams: 50 })).toBeNull();
    expect(convert(1, 'fistful', 'g')).toBeNull();
    expect(toGrams(1, 'medium_apple')).toBeNull();
  });

  it('maps the old food-and-size keys to a measure plus grams per unit', () => {
    expect(legacyUnit('medium_apple')).toEqual({ unit: 'piece', unitGrams: 180 });
    expect(legacyUnit('slice_sangak')).toEqual({ unit: 'slice', unitGrams: 80 });
    expect(legacyUnit('slice_lavash')).toEqual({ unit: 'sheet', unitGrams: 30 });
    expect(legacyUnit('skewer_kabab')).toEqual({ unit: 'skewer', unitGrams: 120 });
    expect(legacyUnit('almond')).toEqual({ unit: 'piece', unitGrams: 1.2 });
    expect(legacyUnit('g')).toBeNull();
    expect(legacyUnit(null)).toBeNull();
    expect(withLegacyUnit({ unit: 'egg', quantity: 2 })).toEqual({
      unit: 'piece',
      unitGrams: 50,
      quantity: 2,
    });
    // An item that already carries its own weight keeps it.
    expect(withLegacyUnit({ unit: 'egg', unitGrams: 60 })).toEqual({
      unit: 'piece',
      unitGrams: 60,
    });
    // A handful kept its key but lost its default weight.
    expect(withLegacyUnit({ unit: 'handful', unitGrams: null })).toEqual({
      unit: 'handful',
      unitGrams: 30,
    });
    expect(withLegacyUnit({ unit: 'g', unitGrams: null })).toEqual({ unit: 'g', unitGrams: null });
    expect(withLegacyUnit('nope')).toBe('nope');
  });

  it('keeps grams per unit only on count units', () => {
    expect(resolveUnitGrams('piece', null, 50)).toBe(50);
    expect(resolveUnitGrams('piece', 45, 50)).toBe(45);
    expect(resolveUnitGrams('g', 45, 50)).toBeNull();
    expect(resolveUnitGrams('piece', null, null)).toBeNull();
  });

  it('renders amounts with plurals; pieces read "2 ×" so the name completes them', () => {
    expect(formatAmount(150, 'g')).toBe('150 g');
    expect(formatAmount(1, 'glass')).toBe('1 glass');
    expect(formatAmount(2, 'glass')).toBe('2 glasses');
    expect(formatAmount(2, 'tbsp')).toBe('2 tbsp');
    expect(formatAmount(2, 'piece')).toBe('2 ×');
    expect(formatAmount(1, 'slice')).toBe('1 slice');
    expect(formatAmount(2, 'slice')).toBe('2 slices');
    expect(formatAmount(1, 'skewer')).toBe('1 skewer');
    expect(formatAmount(3, 'handful')).toBe('3 handfuls');
    expect(formatAmount(1, 'serving')).toBe('1 serving');
    expect(formatAmount(0.5, 'piece')).toBe('0.5 ×');
    expect(formatAmount(2, 'kaf-e dast')).toBe('2 kaf-e dast');
    expect(formatAmount(2, null)).toBe('2');
    expect(portionAmount(3, 'piece')).toBe('3');
    expect(portionAmount(3, 'slice')).toBe('3 slices');
    expect(unitLabel('tbsp')).toBe('tablespoon');
    expect(unitLabel('piece')).toBe('piece');
    expect(unitLabel('kaf-e dast')).toBe('kaf-e dast');
    expect(unitLabel(null)).toBe('');
  });

  it('renders as text for prompts', () => {
    const text = unitTableText();
    expect(text).toContain('glass (240 ml)');
    expect(text).toContain('count: piece, slice, sheet, skewer, handful, serving');
    expect(text).not.toContain('medium_apple');
  });
});
