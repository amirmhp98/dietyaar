import { describe, expect, it } from 'vitest';
import { computeDayView } from '@/lib/rubric/day-view';
import { dayInput, eaten, fi, meal, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

function fullOption(
  p: ReturnType<typeof buildMenuPlan>,
  slotIndex: number,
  optionIndex: number,
  time: string,
) {
  const slot = p.slots[slotIndex];
  const opt = slot.options[optionIndex];
  return meal(
    slot.id,
    opt.id,
    time,
    opt.items.filter((i) => i.quantity !== null).map((i) => eaten(i)),
  );
}

describe('computeDayView', () => {
  it('marked skipped → coverage 4 of 5 · 1 skipped, score unchanged', () => {
    const p = buildMenuPlan();
    const meals = [fullOption(p, 0, 1, '08:30'), fullOption(p, 2, 3, '13:00')];
    const before = computeDayView(dayInput(p.slots, { meals }));
    const after = computeDayView(dayInput(p.slots, { meals, skippedSlotIds: [p.snack2.id] }));
    expect(after.score.coverage).toMatchObject({ prescribed: 5, scored: 2, skipped: 1 });
    expect(after.slots[3].state).toBe('SKIPPED');
    expect(after.score.dayScore).toBe(before.score.dayScore);
  });

  it('first meal of the day: wording band without the number', () => {
    const p = buildMenuPlan();
    const opt1 = p.breakfast.options[0];
    const partly = meal(p.breakfast.id, opt1.id, '08:00', [eaten(opt1.items[0])]); // half the counted items... plus sangak missing
    const view = computeDayView(dayInput(p.slots, { meals: [partly], dayPhase: 'ONGOING' }));
    expect(view.slots[0].match?.status).toBe('PARTLY_MATCHED');
    expect(view.score.showNumber).toBe(false);
    expect(view.score.band).toBe('MOSTLY');
    expect(view.score.coverage.scored).toBe(1);
  });

  it('no scored meal → Not enough information yet', () => {
    const p = buildMenuPlan();
    const view = computeDayView(dayInput(p.slots, { meals: [], hasRecord: false }));
    expect(view.score.band).toBe('NOT_ENOUGH');
    expect(view.score.dayScore).toBeNull();
  });

  it('lunch in two sittings → one slot score, coverage 1 of 5, nutrition counts both (TS-§21.3)', () => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[0];
    const meals = [
      meal(p.lunch.id, opt.id, '13:00', [
        eaten(opt.items[0], 75, 97.5),
        eaten(opt.items[1], 60, 100),
      ]),
      meal(p.lunch.id, opt.id, '14:30', [
        eaten(opt.items[0], 75, 97.5),
        eaten(opt.items[1], 60, 100),
        eaten(opt.items[3]),
      ]),
    ];
    const view = computeDayView(dayInput(p.slots, { meals }));
    const lunch = view.slots[2];
    expect(lunch.mealIds).toHaveLength(2);
    expect(lunch.earliestTime).toBe('13:00');
    expect(lunch.match?.status).toBe('MATCHED');
    expect(lunch.portion?.items.find((i) => i.planItem.englishLabel === 'rice')?.actual).toBe(150);
    expect(view.score.coverage.scored).toBe(1);
    expect(view.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')?.subtotal.value).toBe(
      97.5 * 2 + 200 + 40,
    );
  });

  it('different options in two sittings → Needs review, excluded from the score (TS-§21.4)', () => {
    const p = buildMenuPlan();
    const [o1, o2] = p.lunch.options;
    const view = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(p.lunch.id, o1.id, '13:00', [eaten(o1.items[0])]),
          meal(p.lunch.id, o2.id, '14:00', [eaten(o2.items[0])]),
        ],
      }),
    );
    expect(view.slots[2].state).toBe('NEEDS_REVIEW');
    expect(view.slots[2].conflictingOptionIds).toEqual([o1.id, o2.id]);
    expect(view.score.coverage.scored).toBe(0);
    expect(view.score.coverage.needsReview).toBe(1);
  });

  it('a multi-option slot without a chosen option → Needs review when the items overlap an option; a single-option slot resolves itself', () => {
    const p = buildMenuPlan();
    const o = p.lunch.options[0];
    const view = computeDayView(
      dayInput(p.slots, { meals: [meal(p.lunch.id, null, '13:00', [eaten(o.items[0])])] }),
    );
    expect(view.slots[2].state).toBe('NEEDS_REVIEW');
    expect(view.slots[2].match).toBeNull();
  });

  it('a meal under a multi-option slot that overlaps no option → Recorded · Different food, no option named (B3)', () => {
    const p = buildMenuPlan();
    const burger = fi('ساندویچ همبرگر', 'burger sandwich', 1, 'piece', 'MEAT', 450);
    const view = computeDayView(
      dayInput(p.slots, { meals: [meal(p.lunch.id, null, '13:00', [burger])] }),
    );
    const lunch = view.slots[2];
    expect(lunch.state).toBe('RECORDED');
    expect(lunch.option).toBeNull();
    expect(lunch.match?.status).toBe('DIFFERENT_FOOD');
    expect(lunch.score?.food).toBe(0);
    expect(view.score.coverage).toMatchObject({ recorded: 1, needsReview: 0 });
  });

  it('midnight: ONGOING excludes the nutrition component; PAST with a complete log applies it (TS-§21.5)', () => {
    const p = buildMenuPlan();
    const meals = [
      fullOption(p, 0, 0, '08:00'),
      fullOption(p, 2, 0, '13:00'),
      fullOption(p, 4, 1, '20:00'),
    ];
    const targets = [range(500, 600)];
    const ongoing = computeDayView(dayInput(p.slots, { meals, targets, dayPhase: 'ONGOING' }));
    expect(ongoing.score.nutritionComponent).toBeNull();
    expect(ongoing.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')?.status).toBe('PROGRESS');
    const past = computeDayView(
      dayInput(p.slots, {
        meals,
        targets,
        dayPhase: 'PAST',
        skippedSlotIds: [p.snack1.id, p.snack2.id],
      }),
    );
    expect(past.score.nutritionComponent).toBe(0); // 150+210+195+200+40+200+160 = 1155 ≫ 600
    expect(past.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')?.status).toBe('ABOVE_RANGE');
    expect(past.score.dayScore).toBe(Math.round((past.score.mealMean! * 90) / 100));
    expect(past.trendEligible).toBe(true);
  });

  it('checked past day with unrecorded slots → complete by default, out of trends', () => {
    const p = buildMenuPlan();
    const view = computeDayView(dayInput(p.slots, { meals: [fullOption(p, 2, 0, '13:00')] }));
    expect(view.score.completeByDefault).toBe(true);
    expect(view.trendEligible).toBe(false);
    expect(view.slots[0].state).toBe('NOT_RECORDED');
  });

  it('unchecked day → incomplete log, nutrition status is progress only', () => {
    const p = buildMenuPlan();
    const view = computeDayView(
      dayInput(p.slots, {
        meals: [fullOption(p, 2, 0, '13:00')],
        logComplete: false,
        targets: [range(1500, 1800)],
      }),
    );
    expect(view.score.completeByDefault).toBe(false);
    expect(view.trendEligible).toBe(false);
    expect(view.nutrition[0].status).toBe('PROGRESS');
  });

  it('unknown nutrient values make the subtotal incomplete and never zero', () => {
    const p = buildMenuPlan();
    const opt = p.dinner.options[0];
    const view = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(p.dinner.id, opt.id, '20:00', [
            eaten(opt.items[0]),
            fi('روغن', 'oil', null, null, 'OIL'),
          ]),
        ],
        targets: [range(100, 200)],
      }),
    );
    const energy = view.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')!;
    expect(energy.subtotal.value).toBe(130);
    expect(energy.subtotal.complete).toBe(false);
    expect(energy.status).toBe('INCOMPLETE');
    expect(view.score.nutritionComponent).toBeNull();
  });

  it('the day view is deterministic for identical input', () => {
    const p = buildMenuPlan();
    const input = dayInput(p.slots, {
      meals: [fullOption(p, 0, 1, '08:30'), fullOption(p, 2, 3, '13:00')],
      targets: p.targets,
    });
    expect(JSON.stringify(computeDayView(input))).toBe(
      JSON.stringify(computeDayView(structuredClone(input))),
    );
    expect(computeDayView(input).rubricVersion).toBe('v1');
    expect(computeDayView(input).contributing).toHaveLength(2);
  });

  it("a slot's own window feeds the timing component", () => {
    const p = buildMenuPlan();
    const slots = p.slots.map((s) =>
      s.id === p.lunch.id ? { ...s, timeStart: '12:00', timeEnd: '13:00' } : s,
    );
    const view = computeDayView(dayInput(slots, { meals: [fullOption(p, 2, 0, '15:00')] }));
    expect(view.slots[2].timing).toMatchObject({ kind: 'TIME', band: 'NOTICEABLE', minutes: 120 });
  });
});
