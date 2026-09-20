import { describe, expect, it } from 'vitest';
import type { Nutrition } from '@/lib/validations/nutrition';
import { scaleNutrition } from '@/services/food-data/scale';

const portion: Nutrition = {
  basis: 'PER_RECORDED_PORTION',
  basisQuantity: 80,
  basisUnit: 'g',
  values: {
    ENERGY_KCAL: 210,
    PROTEIN_G: 7.1,
    CARB_G: null,
    FAT_G: 1.234,
    FIBER_G: null,
    SODIUM_MG: null,
  },
  source: 'AI_ESTIMATE',
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
};

const per100: Nutrition = { ...portion, basis: 'PER_100G', basisQuantity: 100, source: 'USDA' };

describe('scaleNutrition', () => {
  it('scales a recorded-portion AI estimate linearly, keeps null, rounds to 3 decimals', () => {
    const { nutrition, flag } = scaleNutrition({
      nutrition: portion,
      fromQuantity: 80,
      fromUnit: 'g',
      toQuantity: 120,
      toUnit: 'g',
    });
    expect(flag).toBe('SCALED');
    expect(nutrition?.values.ENERGY_KCAL).toBe(315);
    expect(nutrition?.values.CARB_G).toBeNull();
    expect(nutrition?.values.FAT_G).toBe(1.851);
    expect(nutrition?.basisQuantity).toBe(120);
  });

  it('scales PER_100G after unit conversion and refuses unknown pairs', () => {
    const ok = scaleNutrition({
      nutrition: per100,
      fromQuantity: 100,
      fromUnit: 'g',
      toQuantity: 2,
      toUnit: 'slice',
      toUnitGrams: 80,
    });
    expect(ok.flag).toBe('SCALED');
    expect(ok.nutrition?.values.ENERGY_KCAL).toBe(336);
    expect(ok.nutrition?.basis).toBe('PER_RECORDED_PORTION');
    expect(ok.nutrition?.basisQuantity).toBe(2);
    const refused = scaleNutrition({
      nutrition: per100,
      fromQuantity: 100,
      fromUnit: 'g',
      toQuantity: 1,
      toUnit: 'glass',
    });
    expect(refused.flag).toBe('NOT_EVALUATED');
  });

  it('a count item scales linearly by count; a unit change converts through the grams of one', () => {
    const twoEggs: Nutrition = { ...portion, basisQuantity: 2, basisUnit: 'piece' };
    const three = scaleNutrition({
      nutrition: twoEggs,
      fromQuantity: 2,
      fromUnit: 'piece',
      fromUnitGrams: 50,
      toQuantity: 3,
      toUnit: 'piece',
      toUnitGrams: 50,
    });
    expect(three.flag).toBe('SCALED');
    expect(three.nutrition?.values.ENERGY_KCAL).toBe(315);
    expect(three.nutrition?.basisQuantity).toBe(3);
    // Without grams the count still scales by count.
    expect(
      scaleNutrition({
        nutrition: twoEggs,
        fromQuantity: 2,
        fromUnit: 'piece',
        toQuantity: 1,
        toUnit: 'piece',
      }).nutrition?.values.ENERGY_KCAL,
    ).toBe(105);
    // 2 × 50 g → 150 g: through unitGrams.
    const grams = scaleNutrition({
      nutrition: twoEggs,
      fromQuantity: 2,
      fromUnit: 'piece',
      fromUnitGrams: 50,
      toQuantity: 150,
      toUnit: 'g',
    });
    expect(grams.flag).toBe('SCALED');
    expect(grams.nutrition?.values.ENERGY_KCAL).toBe(315);
    expect(grams.nutrition?.basisUnit).toBe('g');
    // 150 g → 3 × of 50 g each.
    expect(
      scaleNutrition({
        nutrition: { ...portion, basisQuantity: 150 },
        fromQuantity: 150,
        fromUnit: 'g',
        toQuantity: 3,
        toUnit: 'piece',
        toUnitGrams: 50,
      }).nutrition?.values.ENERGY_KCAL,
    ).toBe(210);
    // A bigger piece: 2 × 50 g → 2 × 60 g.
    expect(
      scaleNutrition({
        nutrition: twoEggs,
        fromQuantity: 2,
        fromUnit: 'piece',
        fromUnitGrams: 50,
        toQuantity: 2,
        toUnit: 'piece',
        toUnitGrams: 60,
      }).nutrition?.values.ENERGY_KCAL,
    ).toBe(252);
    // Grams entered where none were known keep the values and ask for a check.
    const firstGrams = scaleNutrition({
      nutrition: twoEggs,
      fromQuantity: 2,
      fromUnit: 'piece',
      toQuantity: 2,
      toUnit: 'piece',
      toUnitGrams: 50,
    });
    expect(firstGrams.flag).toBe('CHECK_VALUE');
    expect(firstGrams.nutrition?.values.ENERGY_KCAL).toBe(210);
    // No conversion path (count without grams → grams) needs a re-estimate.
    expect(
      scaleNutrition({
        nutrition: twoEggs,
        fromQuantity: 2,
        fromUnit: 'piece',
        toQuantity: 100,
        toUnit: 'g',
      }).flag,
    ).toBe('NEEDS_REESTIMATE');
  });

  it('identity, preparation or unit change needs a re-estimate', () => {
    expect(
      scaleNutrition({
        nutrition: portion,
        fromQuantity: 80,
        fromUnit: 'g',
        toQuantity: 80,
        toUnit: 'g',
        identityChanged: true,
      }).flag,
    ).toBe('NEEDS_REESTIMATE');
    expect(
      scaleNutrition({
        nutrition: portion,
        fromQuantity: 80,
        fromUnit: 'g',
        toQuantity: 1,
        toUnit: 'piece',
      }).flag,
    ).toBe('NEEDS_REESTIMATE');
  });

  it('never scales a user override; quantity change asks for a check', () => {
    const override = { ...portion, userOverride: true, source: 'USER_LABEL' as const };
    const r = scaleNutrition({
      nutrition: override,
      fromQuantity: 80,
      fromUnit: 'g',
      toQuantity: 160,
      toUnit: 'g',
    });
    expect(r.flag).toBe('CHECK_VALUE');
    expect(r.nutrition?.values.ENERGY_KCAL).toBe(210);
  });

  it('label and USDA portion values do not scale linearly', () => {
    const label = { ...portion, source: 'USER_LABEL' as const };
    expect(
      scaleNutrition({
        nutrition: label,
        fromQuantity: 80,
        fromUnit: 'g',
        toQuantity: 90,
        toUnit: 'g',
      }).flag,
    ).toBe('NEEDS_REESTIMATE');
    expect(
      scaleNutrition({
        nutrition: portion,
        fromQuantity: 80,
        fromUnit: 'g',
        toQuantity: 80,
        toUnit: 'g',
      }).flag,
    ).toBe('UNCHANGED');
  });
});
