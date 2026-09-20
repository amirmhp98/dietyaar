import { energyResult } from '@/lib/rubric/energy';
import type {
  DayPhase,
  NutrientSubtotal,
  RubricFoodItem,
  RubricTarget,
  TargetComparison,
} from '@/lib/rubric/types';
import { NUTRIENT_KEYS, type NutrientKey, type NutritionValues } from '@/lib/validations/nutrition';
import { round3, toGrams } from '@/lib/units';

/** The nutrient values of one recorded item for its recorded portion, or null per nutrient. */
export function portionValues(item: RubricFoodItem): NutritionValues | null {
  const n = item.nutrition;
  if (!n) return null;
  if (n.basis === 'PER_RECORDED_PORTION') return n.values;
  if (item.quantity === null || item.unit === null || item.quantityUnknown) return null;
  const grams = toGrams(item.quantity, item.unit, { unitGrams: item.unitGrams });
  if (grams === null) return null;
  const out: NutritionValues = { ...n.values };
  for (const key of NUTRIENT_KEYS) {
    const v = n.values[key];
    out[key] = v === null || v === undefined ? null : round3((v * grams) / 100);
  }
  return out;
}

/** Every meal once, including "Other"; a missing value makes the subtotal incomplete, never zero. */
export function nutritionSubtotals(items: RubricFoodItem[]): NutrientSubtotal[] {
  return NUTRIENT_KEYS.map((nutrient) => {
    let value = 0;
    let any = false;
    let missing = 0;
    for (const item of items) {
      const values = portionValues(item);
      const v = values?.[nutrient];
      if (v === null || v === undefined) {
        missing += 1;
        continue;
      }
      value += v;
      any = true;
    }
    return {
      nutrient,
      value: any ? round3(value) : null,
      complete: items.length > 0 && missing === 0,
      missingItems: missing,
    };
  });
}

/** Product spec § 8 target table. */
export function compareTarget(
  subtotal: NutrientSubtotal,
  target: RubricTarget | null,
  dayPhase: DayPhase,
  logComplete: boolean,
): TargetComparison {
  const base = { nutrient: subtotal.nutrient, subtotal, target };
  if (!target) return { ...base, status: 'NO_TARGET', difference: null };
  if (subtotal.value === null || !subtotal.complete)
    return { ...base, status: 'INCOMPLETE', difference: null };
  const definitive = dayPhase === 'PAST' && logComplete;
  const x = subtotal.value;
  const { type, low, high } = target;

  if (!definitive) {
    // Maximum: an exceeded recorded limit may be stated as such even on an ongoing day.
    const limit = type === 'MAXIMUM' ? (high ?? low) : null;
    if (limit !== null && x > limit)
      return { ...base, status: 'ABOVE_LIMIT', difference: round3(x - limit) };
    return { ...base, status: 'PROGRESS', difference: null };
  }

  switch (type) {
    case 'RANGE': {
      if (low !== null && x < low)
        return { ...base, status: 'BELOW_RANGE', difference: round3(x - low) };
      if (high !== null && x > high)
        return { ...base, status: 'ABOVE_RANGE', difference: round3(x - high) };
      return { ...base, status: 'WITHIN_RANGE', difference: 0 };
    }
    case 'MINIMUM':
      return low !== null && x < low
        ? { ...base, status: 'BELOW_TARGET', difference: round3(x - low) }
        : { ...base, status: 'TARGET_MET', difference: 0 };
    case 'MAXIMUM': {
      const limit = high ?? low ?? 0;
      return x > limit
        ? { ...base, status: 'ABOVE_LIMIT', difference: round3(x - limit) }
        : { ...base, status: 'WITHIN_LIMIT', difference: 0 };
    }
    case 'DESIRED':
    case 'APPROXIMATE':
      return { ...base, status: 'SIGNED_DIFFERENCE', difference: round3(x - (low ?? 0)) };
  }
}

/** The daily target for a nutrient: explicit wins, then estimated, then sum of meals. */
export function dailyTargetFor(
  targets: RubricTarget[],
  nutrient: NutrientKey,
): RubricTarget | null {
  const daily = targets.filter((t) => t.planSlotId === null && t.nutrient === nutrient);
  const order = ['EXPLICIT', 'ESTIMATED', 'SUM_OF_MEALS'];
  daily.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));
  return daily[0] ?? null;
}

/** Nutrition component of the day score: full within, half slightly beyond, none otherwise. */
export function nutritionComponent(
  energy: NutrientSubtotal,
  target: RubricTarget | null,
  dayPhase: DayPhase,
  logComplete: boolean,
): { component: number | null; energy: ReturnType<typeof energyResult> | null } {
  if (!target || energy.value === null) return { component: null, energy: null };
  const result = energyResult(energy.value, target);
  if (!(dayPhase === 'PAST' && logComplete && energy.complete))
    return { component: null, energy: result };
  const component = result.band === 'SMALL' ? 1 : result.band === 'NOTICEABLE' ? 0.5 : 0;
  return { component, energy: result };
}
