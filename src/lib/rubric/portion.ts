import { PORTION_NOTICEABLE, PORTION_SMALL } from '@/lib/rubric/constants';
import { isCounted } from '@/lib/rubric/match-slot';
import type { MatchResult, PortionResult, RubricFoodItem } from '@/lib/rubric/types';
import type { Band } from '@/lib/time/bands';
import { convert } from '@/lib/units';

export function portionBand(ratio: number): Band {
  const abs = Math.abs(ratio);
  if (abs <= PORTION_SMALL + 1e-9) return 'SMALL';
  if (abs <= PORTION_NOTICEABLE + 1e-9) return 'NOTICEABLE';
  return 'LARGE';
}

export function bandValue(band: Band): number {
  return band === 'SMALL' ? 1 : band === 'NOTICEABLE' ? 0.5 : 0;
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
    if (planItem.quantity === null || planItem.unit === null || planItem.quantity <= 0) {
      notEvaluated.push(...recorded);
      continue;
    }
    let actual = 0;
    let evaluable = true;
    for (const r of recorded) {
      if (r.quantity === null || r.quantityUnknown || r.unit === null) {
        evaluable = false;
        break;
      }
      const converted = convert(r.quantity, r.unit, planItem.unit);
      if (converted === null) {
        evaluable = false;
        break;
      }
      actual += converted;
    }
    if (!evaluable) {
      notEvaluated.push(...recorded);
      continue;
    }
    const ratio = (actual - planItem.quantity) / planItem.quantity;
    items.push({
      item: recorded[0],
      planItem,
      actual: Math.round(actual * 1000) / 1000,
      planned: planItem.quantity,
      unit: planItem.unit,
      ratio: Math.round(ratio * 10000) / 10000,
      band: portionBand(ratio),
    });
  }

  const mean =
    items.length === 0 ? null : items.reduce((sum, i) => sum + bandValue(i.band), 0) / items.length;
  return { items, mean, notEvaluated };
}
