import { PORTION_NOTICEABLE, PORTION_SMALL } from '@/lib/rubric/constants';
import { isCounted } from '@/lib/rubric/match-slot';
import type {
  MatchResult,
  PortionResult,
  RubricFoodItem,
  RubricPlanItem,
} from '@/lib/rubric/types';
import type { Band } from '@/lib/time/bands';
import { convert, isCountUnit, round3 } from '@/lib/units';

export function portionBand(ratio: number): Band {
  const abs = Math.abs(ratio);
  if (abs <= PORTION_SMALL + 1e-9) return 'SMALL';
  if (abs <= PORTION_NOTICEABLE + 1e-9) return 'NOTICEABLE';
  return 'LARGE';
}

export function bandValue(band: Band): number {
  return band === 'SMALL' ? 1 : band === 'NOTICEABLE' ? 0.5 : 0;
}

/** An amount in a common measure: grams (mass, or a count through `unitGrams`) or millilitres. */
interface Measured {
  base: 'g' | 'ml';
  value: number;
}

function measured(
  quantity: number,
  unit: string,
  unitGrams: number | null,
  base?: 'g' | 'ml',
): Measured | null {
  const bases: Array<'g' | 'ml'> = base ? [base] : ['g', 'ml'];
  for (const b of bases) {
    const value = convert(quantity, unit, b, { unitGrams });
    if (value !== null) return { base: b, value };
  }
  return null;
}

/**
 * Compare the recorded amounts of one plan item with the prescribed one
 * (product spec § 8 "Portion of a matched item", decision 024):
 * 1. in a common measure when every side converts (grams through `unitGrams`
 *    for count units, so "1 slice" of sangak and "120 g" compare);
 * 2. otherwise by quantity when every side uses the plan item's own unit
 *    (2 eggs against 3 eggs, even without a weight; a glass against a glass);
 * 3. otherwise not evaluated.
 * The result is presented in the plan item's unit when the sides share it
 * and the same grams per unit, otherwise in the measure they were compared in.
 */
function comparePortion(
  planItem: RubricPlanItem & { quantity: number; unit: string },
  recorded: RubricFoodItem[],
): { actual: number; planned: number; unit: string } | null {
  const sameUnit = recorded.every((r) => r.unit === planItem.unit);
  const sameGrams = recorded.every((r) => r.unitGrams === planItem.unitGrams);
  const quantities = recorded.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

  const plannedMeasure = measured(planItem.quantity, planItem.unit, planItem.unitGrams);
  if (plannedMeasure) {
    let actual = 0;
    let convertible = true;
    for (const r of recorded) {
      const m = measured(r.quantity ?? 0, r.unit ?? '', r.unitGrams, plannedMeasure.base);
      if (!m) {
        convertible = false;
        break;
      }
      actual += m.value;
    }
    if (convertible) {
      return sameUnit && (!isCountUnit(planItem.unit) || sameGrams)
        ? { actual: quantities, planned: planItem.quantity, unit: planItem.unit }
        : { actual, planned: plannedMeasure.value, unit: plannedMeasure.base };
    }
  }
  if (sameUnit) return { actual: quantities, planned: planItem.quantity, unit: planItem.unit };
  return null;
}

/**
 * Per-item portion bands over the counted matched items and their mean.
 * Unknown quantities or non-convertible units are "Not evaluated", never zero.
 * Several recorded items matched to the same plan item are summed first (a
 * lunch in two sittings).
 */
export function portionResult(match: MatchResult): PortionResult {
  const byPlanItem = new Map<
    string,
    { planItem: MatchResult['matched'][number]['planItem']; items: RubricFoodItem[] }
  >();
  for (const { item, planItem } of match.matched) {
    if (!isCounted(planItem)) continue;
    const entry = byPlanItem.get(planItem.id) ?? { planItem, items: [] };
    entry.items.push(item);
    byPlanItem.set(planItem.id, entry);
  }

  const items: PortionResult['items'] = [];
  const notEvaluated: RubricFoodItem[] = [];
  for (const { planItem, items: recorded } of byPlanItem.values()) {
    const { quantity, unit } = planItem;
    if (quantity === null || unit === null || quantity <= 0) {
      notEvaluated.push(...recorded);
      continue;
    }
    const known = recorded.every(
      (r) => r.quantity !== null && !r.quantityUnknown && r.unit !== null,
    );
    const compared = known ? comparePortion({ ...planItem, quantity, unit }, recorded) : null;
    if (!compared) {
      notEvaluated.push(...recorded);
      continue;
    }
    const ratio = (compared.actual - compared.planned) / compared.planned;
    items.push({
      item: recorded[0],
      planItem,
      actual: round3(compared.actual),
      planned: round3(compared.planned),
      unit: compared.unit,
      ratio: Math.round(ratio * 10000) / 10000,
      band: portionBand(ratio),
    });
  }

  const mean =
    items.length === 0 ? null : items.reduce((sum, i) => sum + bandValue(i.band), 0) / items.length;
  return { items, mean, notEvaluated };
}
