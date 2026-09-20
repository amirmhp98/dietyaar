import { MIN_COMPLETE_DAYS_FOR_TREND } from '@/lib/rubric/constants';
import type { DayView, FoodName } from '@/lib/rubric/types';

/**
 * One-sentence pattern summary with denominators (product spec § 10).
 * Priority: a slot Different food or skipped on ≥ 3 days, a repeated portion
 * difference on the same item, a repeated order difference, energy against the
 * daily range; otherwise what matched most often.
 */
export type SevenDaySummary =
  | { kind: 'NOT_ENOUGH'; completeDays: number; incompleteDays: number }
  | {
      kind: 'SLOT_DIFFERENT';
      slot: FoodName;
      /** Which of the two the sentence names: a different food, or a slot marked skipped. */
      reason: 'DIFFERENT_FOOD' | 'SKIPPED';
      days: number;
      completeDays: number;
      incompleteDays: number;
    }
  | {
      kind: 'PORTION';
      item: FoodName;
      direction: 'MORE' | 'LESS';
      days: number;
      completeDays: number;
      incompleteDays: number;
    }
  | { kind: 'ORDER'; slot: FoodName; days: number; completeDays: number; incompleteDays: number }
  | {
      kind: 'ENERGY';
      status: 'WITHIN' | 'ABOVE' | 'BELOW';
      days: number;
      completeDays: number;
      incompleteDays: number;
    }
  | {
      kind: 'MATCHED_MOST';
      slot: FoodName;
      days: number;
      completeDays: number;
      incompleteDays: number;
    }
  | { kind: 'NO_PATTERN'; completeDays: number; incompleteDays: number };

export function sevenDaySummary(days: DayView[]): SevenDaySummary {
  const past = days.filter((d) => d.dayPhase === 'PAST');
  const complete = past.filter((d) => d.trendEligible);
  const incompleteDays = past.filter((d) => d.mealCount > 0 && !d.trendEligible).length;
  const completeDays = complete.length;
  if (completeDays < MIN_COMPLETE_DAYS_FOR_TREND)
    return { kind: 'NOT_ENOUGH', completeDays, incompleteDays };

  const name = (f: FoodName): FoodName => ({
    originalName: f.originalName,
    englishLabel: f.englishLabel,
  });
  const count = <T>(entries: Array<[string, T]>) => {
    const map = new Map<string, { value: T; days: number }>();
    for (const [key, value] of entries) {
      const e = map.get(key) ?? { value, days: 0 };
      e.days += 1;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.days - a.days)[0];
  };

  // 1. A slot that was Different food (first) or marked skipped on three or more days.
  const slotReasons: Array<
    ['DIFFERENT_FOOD' | 'SKIPPED', (s: DayView['slots'][number]) => boolean]
  > = [
    ['DIFFERENT_FOOD', (s) => s.match?.status === 'DIFFERENT_FOOD'],
    ['SKIPPED', (s) => s.state === 'SKIPPED'],
  ];
  for (const [reason, predicate] of slotReasons) {
    const top = count(
      complete.flatMap((d) =>
        d.slots
          .filter(predicate)
          .map((s): [string, FoodName] => [s.slot.englishLabel, name(s.slot)]),
      ),
    );
    if (top && top.days >= 3) {
      return {
        kind: 'SLOT_DIFFERENT',
        slot: top.value,
        reason,
        days: top.days,
        completeDays,
        incompleteDays,
      };
    }
  }

  // 2. Repeated portion difference on the same item.
  const portion = count(
    complete.flatMap((d) =>
      d.slots.flatMap((s) =>
        (s.portion?.items ?? [])
          .filter((p) => p.band !== 'SMALL')
          .map((p): [string, { item: FoodName; direction: 'MORE' | 'LESS' }] => [
            `${p.planItem.englishLabel}:${p.ratio > 0 ? 'MORE' : 'LESS'}`,
            { item: name(p.planItem), direction: p.ratio > 0 ? 'MORE' : 'LESS' },
          ]),
      ),
    ),
  );
  if (portion && portion.days >= 2) {
    return {
      kind: 'PORTION',
      item: portion.value.item,
      direction: portion.value.direction,
      days: portion.days,
      completeDays,
      incompleteDays,
    };
  }

  // 3. Repeated order difference.
  const order = count(
    complete.flatMap((d) =>
      d.slots
        .filter((s) => s.timing?.band && s.timing.band !== 'SMALL')
        .map((s): [string, FoodName] => [s.slot.englishLabel, name(s.slot)]),
    ),
  );
  if (order && order.days >= 2) {
    return { kind: 'ORDER', slot: order.value, days: order.days, completeDays, incompleteDays };
  }

  // 4. Energy against the daily range.
  const withEnergy = complete.filter((d) => d.dailyEnergy);
  if (withEnergy.length >= MIN_COMPLETE_DAYS_FOR_TREND) {
    const within = withEnergy.filter((d) => d.dailyEnergy!.status === 'WITHIN').length;
    const above = withEnergy.filter((d) => d.dailyEnergy!.status === 'ABOVE').length;
    const below = withEnergy.length - within - above;
    if (above > within && above >= below)
      return {
        kind: 'ENERGY',
        status: 'ABOVE',
        days: above,
        completeDays: withEnergy.length,
        incompleteDays,
      };
    if (below > within)
      return {
        kind: 'ENERGY',
        status: 'BELOW',
        days: below,
        completeDays: withEnergy.length,
        incompleteDays,
      };
    if (within > 0)
      return {
        kind: 'ENERGY',
        status: 'WITHIN',
        days: within,
        completeDays: withEnergy.length,
        incompleteDays,
      };
  }

  // Otherwise: what matched most often.
  const matched = count(
    complete.flatMap((d) =>
      d.slots
        .filter((s) => s.match?.status === 'MATCHED')
        .map((s): [string, FoodName] => [s.slot.englishLabel, name(s.slot)]),
    ),
  );
  if (matched)
    return {
      kind: 'MATCHED_MOST',
      slot: matched.value,
      days: matched.days,
      completeDays,
      incompleteDays,
    };
  return { kind: 'NO_PATTERN', completeDays, incompleteDays };
}
