import { describe, expect, it } from 'vitest';
import {
  compareTarget,
  dailyTargetFor,
  nutritionSubtotals,
  portionValues,
} from '@/lib/rubric/nutrition';
import { sevenDaySummary } from '@/lib/rubric/seven-day';
import { computeDayView } from '@/lib/rubric/day-view';
import type { NutrientSubtotal, RubricTarget } from '@/lib/rubric/types';
import { dayInput, eaten, fi, meal, nutrition, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

const sub = (value: number | null, complete = true): NutrientSubtotal => ({
  nutrient: 'PROTEIN_G',
  value,
  complete,
  missingItems: complete ? 0 : 1,
});
const target = (
  type: RubricTarget['type'],
  low: number | null,
  high: number | null,
): RubricTarget => ({
  planSlotId: null,
  nutrient: 'PROTEIN_G',
  type,
  low,
  high,
  source: 'EXPLICIT',
});

describe('portionValues and subtotals', () => {
  it('scales PER_100G values to the recorded grams and refuses unknown units', () => {
    const per100 = nutrition(200, 10, null, 5, {
      basis: 'PER_100G',
      basisQuantity: 100,
      basisUnit: 'g',
      source: 'USDA',
    });
    expect(
      portionValues(fi('برنج', 'rice', 150, 'g', 'RICE', null, { nutrition: per100 }))?.ENERGY_KCAL,
    ).toBe(300);
    expect(
      portionValues(
        fi('برنج', 'rice', 2, 'slice', 'RICE', null, { nutrition: per100, unitGrams: 80 }),
      )?.PROTEIN_G,
    ).toBe(16);
    expect(
      portionValues(fi('شیر', 'milk', 1, 'glass', 'DAIRY', null, { nutrition: per100 })),
    ).toBeNull();
    expect(
      portionValues(fi('شیر', 'milk', null, null, 'DAIRY', null, { nutrition: per100 })),
    ).toBeNull();
    expect(portionValues(fi('شیر', 'milk', 1, 'glass', 'DAIRY'))).toBeNull();
  });

  it('subtotals never turn unknown into zero', () => {
    const [energy, protein] = nutritionSubtotals([
      fi('a', 'a', 1, 'g', 'OTHER', 100),
      fi('b', 'b', 1, 'g', 'OTHER', null),
    ]);
    expect(energy).toMatchObject({ value: 100, complete: false, missingItems: 1 });
    expect(protein.value).toBeNull();
    expect(nutritionSubtotals([])[0]).toMatchObject({ value: null, complete: false });
  });
});

describe('compareTarget', () => {
  it('follows the product spec § 8 table on a complete past day', () => {
    expect(compareTarget(sub(80), target('MINIMUM', 100, null), 'PAST', true)).toMatchObject({
      status: 'BELOW_TARGET',
      difference: -20,
    });
    expect(compareTarget(sub(100), target('MINIMUM', 100, null), 'PAST', true).status).toBe(
      'TARGET_MET',
    );
    expect(compareTarget(sub(100), target('MAXIMUM', null, 100), 'PAST', true).status).toBe(
      'WITHIN_LIMIT',
    );
    expect(compareTarget(sub(101), target('MAXIMUM', null, 100), 'PAST', true)).toMatchObject({
      status: 'ABOVE_LIMIT',
      difference: 1,
    });
    expect(compareTarget(sub(90), target('DESIRED', 100, null), 'PAST', true)).toMatchObject({
      status: 'SIGNED_DIFFERENCE',
      difference: -10,
    });
    expect(compareTarget(sub(90), target('RANGE', 100, 120), 'PAST', true)).toMatchObject({
      status: 'BELOW_RANGE',
      difference: -10,
    });
    expect(compareTarget(sub(110), target('RANGE', 100, 120), 'PAST', true).status).toBe(
      'WITHIN_RANGE',
    );
    expect(compareTarget(sub(130), target('RANGE', 100, 120), 'PAST', true).status).toBe(
      'ABOVE_RANGE',
    );
  });

  it('ongoing or incomplete: progress only, except an exceeded maximum', () => {
    expect(compareTarget(sub(130), target('RANGE', 100, 120), 'ONGOING', true).status).toBe(
      'PROGRESS',
    );
    expect(compareTarget(sub(130), target('RANGE', 100, 120), 'PAST', false).status).toBe(
      'PROGRESS',
    );
    expect(compareTarget(sub(130), target('MAXIMUM', null, 120), 'ONGOING', true).status).toBe(
      'ABOVE_LIMIT',
    );
    expect(compareTarget(sub(130), target('MAXIMUM', 120, null), 'ONGOING', true).status).toBe(
      'ABOVE_LIMIT',
    );
    expect(compareTarget(sub(130, false), target('RANGE', 100, 120), 'PAST', true).status).toBe(
      'INCOMPLETE',
    );
    expect(compareTarget(sub(null), target('RANGE', 100, 120), 'PAST', true).status).toBe(
      'INCOMPLETE',
    );
    expect(compareTarget(sub(130), null, 'PAST', true).status).toBe('NO_TARGET');
  });

  it('explicit daily targets win over estimated and summed ones', () => {
    const targets: RubricTarget[] = [
      { ...range(1, 2), source: 'SUM_OF_MEALS' },
      { ...range(3, 4), source: 'ESTIMATED' },
      { ...range(5, 6), source: 'EXPLICIT' },
    ];
    expect(dailyTargetFor(targets, 'ENERGY_KCAL')?.low).toBe(5);
    expect(dailyTargetFor(targets.slice(0, 2), 'ENERGY_KCAL')?.low).toBe(3);
    expect(dailyTargetFor(targets, 'FAT_G')).toBeNull();
  });
});

describe('seven-day energy branches', () => {
  const build = (kcal: number) => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[0];
    return [0, 1, 2].map((d) =>
      computeDayView(
        dayInput([p.lunch], {
          localDate: `2026-09-1${d}`,
          targets: [range(400, 500)],
          meals: [
            meal(p.lunch.id, opt.id, '13:00', [
              eaten(opt.items[0], 150, kcal),
              eaten(opt.items[1], 120, 0),
              eaten(opt.items[3], 1, 0),
            ]),
          ],
        }),
      ),
    );
  };
  it('reports below and within the daily range', () => {
    expect(sevenDaySummary(build(100))).toMatchObject({ kind: 'ENERGY', status: 'BELOW', days: 3 });
    expect(sevenDaySummary(build(450))).toMatchObject({
      kind: 'ENERGY',
      status: 'WITHIN',
      days: 3,
    });
  });
});
