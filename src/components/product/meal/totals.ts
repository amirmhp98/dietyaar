import { toGrams } from '@/lib/units';
import type { DraftFoodItem } from '@/lib/validations/meal';
import {
  EMPTY_VALUES,
  MAIN_NUTRIENTS,
  NUTRIENT_KEYS,
  type Nutrition,
  type NutrientKey,
  type NutritionValues,
} from '@/lib/validations/nutrition';

/**
 * Client-side totals for the review (product spec § 7 "AI review"): the sum
 * of the items' values per recorded portion. PER_100G values scale by the
 * portion's grams; an item that cannot be scaled counts as unknown. Unknown
 * never becomes zero.
 */
export function portionValues(
  item: Pick<DraftFoodItem, 'quantity' | 'unit' | 'quantityUnknown'> & {
    nutrition: Nutrition | null;
  },
): NutritionValues | null {
  const n = item.nutrition;
  if (!n) return null;
  if (n.basis !== 'PER_100G') return n.values;
  if (item.quantityUnknown || item.quantity === null || !item.unit) return null;
  const grams = toGrams(item.quantity, item.unit);
  if (grams === null) return null;
  const factor = grams / 100;
  const out: NutritionValues = { ...EMPTY_VALUES };
  for (const key of NUTRIENT_KEYS) {
    const v = n.values[key];
    out[key] = v === null || v === undefined ? null : Math.round(v * factor * 10) / 10;
  }
  return out;
}

export interface Totals {
  values: Record<NutrientKey, number | null>;
  /** True when any item has an unknown value for one of the four main nutrients. */
  incomplete: boolean;
}

export function sumTotals(items: Array<Parameters<typeof portionValues>[0]>): Totals {
  const values: Record<NutrientKey, number | null> = { ...EMPTY_VALUES };
  const known: Record<NutrientKey, boolean> = {
    ENERGY_KCAL: false,
    PROTEIN_G: false,
    CARB_G: false,
    FAT_G: false,
    FIBER_G: false,
    SODIUM_MG: false,
  };
  let incomplete = false;
  for (const item of items) {
    const v = portionValues(item);
    for (const key of NUTRIENT_KEYS) {
      const value = v?.[key] ?? null;
      if (value === null) {
        if ((MAIN_NUTRIENTS as readonly string[]).includes(key)) incomplete = true;
        continue;
      }
      values[key] = (values[key] ?? 0) + value;
      known[key] = true;
    }
  }
  for (const key of NUTRIENT_KEYS) {
    if (!known[key]) values[key] = null;
    else values[key] = Math.round((values[key] ?? 0) * 10) / 10;
  }
  return { values, incomplete: incomplete || items.length === 0 };
}

export const NUTRIENT_UNITS: Record<NutrientKey, 'kcal' | 'g' | 'mg'> = {
  ENERGY_KCAL: 'kcal',
  PROTEIN_G: 'g',
  CARB_G: 'g',
  FAT_G: 'g',
  FIBER_G: 'g',
  SODIUM_MG: 'mg',
};
