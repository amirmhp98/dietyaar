import { NUTRIENT_KEYS, type Nutrition, type NutritionValues } from '@/lib/validations/nutrition';
import { round3, toGrams } from '@/lib/units';

/**
 * Tech spec § 5.1 scaling rules. Pure: takes the stored nutrition and the
 * portion change, returns the new nutrition plus a flag the review renders.
 */
export type ScaleFlag =
  /** Values were rescaled linearly. */
  | 'SCALED'
  /** Nothing to do (same quantity and unit). */
  | 'UNCHANGED'
  /** userOverride values are kept; the quantity changed so the row says "Check this value". */
  | 'CHECK_VALUE'
  /** Identity, preparation or unit changed: previous values shown struck through until re-estimated. */
  | 'NEEDS_REESTIMATE'
  /** PER_100G with a unit that cannot be converted to grams: nutrient shows "Not evaluated". */
  | 'NOT_EVALUATED';

export interface ScaleInput {
  nutrition: Nutrition | null;
  fromQuantity: number | null;
  fromUnit: string | null;
  /** Grams of one unit on each side, for count units (decision 024). */
  fromUnitGrams?: number | null;
  toQuantity: number | null;
  toUnit: string | null;
  toUnitGrams?: number | null;
  /** True when the user changed the food identity or preparation. */
  identityChanged?: boolean;
  density?: number;
}

export interface ScaleResult {
  nutrition: Nutrition | null;
  flag: ScaleFlag;
}

function scaleValues(values: NutritionValues, factor: number): NutritionValues {
  const out = { ...values };
  for (const key of NUTRIENT_KEYS) {
    const v = values[key];
    out[key] = v === null || v === undefined ? null : round3(v * factor);
  }
  return out;
}

function gramsOf(
  quantity: number | null,
  unit: string | null,
  unitGrams: number | null | undefined,
  density: number | undefined,
): number | null {
  if (quantity === null || unit === null) return null;
  return toGrams(quantity, unit, { unitGrams, density });
}

export function scaleNutrition(input: ScaleInput): ScaleResult {
  const {
    nutrition,
    fromQuantity,
    fromUnit,
    fromUnitGrams = null,
    toQuantity,
    toUnit,
    toUnitGrams = null,
    identityChanged,
    density,
  } = input;
  if (!nutrition)
    return { nutrition: null, flag: identityChanged ? 'NEEDS_REESTIMATE' : 'UNCHANGED' };

  const quantityChanged = fromQuantity !== toQuantity;
  const unitChanged = fromUnit !== toUnit;
  const unitGramsChanged = (fromUnitGrams ?? null) !== (toUnitGrams ?? null);

  // Rule 4: user overrides never scale.
  if (nutrition.userOverride) {
    if (identityChanged || unitChanged) return { nutrition, flag: 'NEEDS_REESTIMATE' };
    return { nutrition, flag: quantityChanged || unitGramsChanged ? 'CHECK_VALUE' : 'UNCHANGED' };
  }

  // Rule 3: identity or preparation change requires a fresh estimate.
  if (identityChanged) return { nutrition, flag: 'NEEDS_REESTIMATE' };

  if (nutrition.basis === 'PER_100G') {
    // Rule 1: linear after conversion to grams; refuse unknown pairs.
    if (toQuantity === null || toUnit === null) return { nutrition, flag: 'NOT_EVALUATED' };
    const grams = gramsOf(toQuantity, toUnit, toUnitGrams, density);
    if (grams === null) return { nutrition, flag: 'NOT_EVALUATED' };
    const values = scaleValues(nutrition.values, grams / 100);
    // The result describes the recorded portion, so the basis changes with it.
    return {
      nutrition: {
        ...nutrition,
        basis: 'PER_RECORDED_PORTION',
        basisQuantity: toQuantity,
        basisUnit: toUnit,
        values,
      },
      flag: 'SCALED',
    };
  }

  // PER_RECORDED_PORTION
  if (!quantityChanged && !unitChanged && !unitGramsChanged)
    return { nutrition, flag: 'UNCHANGED' };
  // Rule 2: linear only for AI_ESTIMATE / RECIPE; label and USDA values are tied to their portion.
  if (nutrition.source !== 'AI_ESTIMATE' && nutrition.source !== 'RECIPE') {
    return { nutrition, flag: 'NEEDS_REESTIMATE' };
  }
  if (fromQuantity === null || toQuantity === null || fromQuantity <= 0) {
    return { nutrition, flag: 'NEEDS_REESTIMATE' };
  }
  // Grams per unit entered where none were known: the recorded portion the
  // model estimated is unchanged, so the values stay and the row asks for a check.
  if (!unitChanged && !quantityChanged && unitGramsChanged && fromUnitGrams === null) {
    return { nutrition, flag: 'CHECK_VALUE' };
  }
  // A unit change, or a change of the grams per unit, scales through grams when
  // both portions weigh something ("2 ×" of 50 g each → 150 g); otherwise the
  // pair has no conversion path and the item needs a new estimate.
  let factor: number;
  if (unitChanged || unitGramsChanged) {
    const fromGrams = gramsOf(fromQuantity, fromUnit, fromUnitGrams, density);
    const toGramsValue = gramsOf(toQuantity, toUnit, toUnitGrams, density);
    if (fromGrams === null || toGramsValue === null || fromGrams <= 0)
      return { nutrition, flag: 'NEEDS_REESTIMATE' };
    factor = toGramsValue / fromGrams;
  } else {
    factor = toQuantity / fromQuantity;
  }
  const values = scaleValues(nutrition.values, factor);
  return {
    nutrition: {
      ...nutrition,
      values,
      basisQuantity: toQuantity,
      basisUnit: toUnit,
      isEstimate: true,
    },
    flag: 'SCALED',
  };
}
