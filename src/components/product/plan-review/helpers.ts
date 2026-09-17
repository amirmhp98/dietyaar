import { formatDate, formatNumber } from '@/lib/format';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { unitByKey } from '@/lib/units';
import type { NutrientKey } from '@/lib/validations/nutrition';
import type { DraftSlot, DraftTarget, PlanDraft } from '@/lib/validations/plan';
import { EVERY_DAY } from '@/lib/validations/plan';

/**
 * Small pure helpers shared by the review screens, the manual wizard and My
 * plan: labels for nutrients, units and weekdays, target wording, and the
 * digit-tolerant number parsing product spec § 5 asks for.
 */

export function nutrientLabel(nutrient: NutrientKey): string {
  return t(`plan.nutrient.${nutrient}`);
}

export function nutrientUnit(nutrient: NutrientKey): string {
  if (nutrient === 'ENERGY_KCAL') return t('plan.unit.kcal');
  if (nutrient === 'SODIUM_MG') return t('plan.unit.mg');
  return t('plan.unit.g');
}

/** Unit-table keys become their label; free-text units are shown as written. */
export function unitLabel(unit: string | null): string {
  if (!unit) return '';
  return unitByKey(unit)?.label ?? unit;
}

/** 2024-01-07 is a Sunday; weekday 0–6 = Sunday–Saturday, 7 = every day. */
export function weekdayName(weekday: number, style: 'long' | 'short' = 'long'): string {
  if (weekday === EVERY_DAY) return t('plan.weekday.everyDay');
  const date = new Date(Date.UTC(2024, 0, 7 + weekday));
  return formatDate(date, { weekday: style, timeZone: 'UTC' });
}

export function targetSourceLabel(source: DraftTarget['source']): string {
  if (source === 'ESTIMATED') return t('plan.target.estimated');
  if (source === 'SUM_OF_MEALS') return t('plan.target.sumOfMeals');
  return t('plan.target.explicit');
}

/** "300–400 kcal", "At least 25 g", "About 2,200 kcal". */
export function targetValueText(target: Pick<DraftTarget, 'nutrient' | 'type' | 'low' | 'high'>) {
  const unit = nutrientUnit(target.nutrient);
  const low = formatNumber(target.low, { maximumFractionDigits: 0 });
  const high = formatNumber(target.high, { maximumFractionDigits: 0 });
  switch (target.type) {
    case 'RANGE':
      return t('plan.target.rangeValue', { low, high, unit });
    case 'MINIMUM':
      return t('plan.target.atLeast', { value: low, unit });
    case 'MAXIMUM':
      return t('plan.target.atMost', { value: high, unit });
    case 'APPROXIMATE':
      return t('plan.target.about', { value: low, unit });
    default:
      return t('plan.target.desired', { value: low, unit });
  }
}

/** Persian/Arabic digits accepted; empty → null; anything else → NaN. */
export function parseNumber(raw: string): number | null {
  const text = normalizeDigits(raw).trim().replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function numberText(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Weekdays in plan order (first appearance), for weekday plans. */
export function weekdaysInPlanOrder(slots: DraftSlot[]): number[] {
  const seen: number[] = [];
  for (const slot of slots) if (!seen.includes(slot.weekday)) seen.push(slot.weekday);
  return seen;
}

export function slotsOfWeekday(draft: Pick<PlanDraft, 'slots'>, weekday: number): DraftSlot[] {
  return draft.slots.filter((s) => s.weekday === weekday).sort((a, b) => a.position - b.position);
}

export function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
