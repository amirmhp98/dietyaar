import { describe, expect, it } from 'vitest';
import { computeDayView } from '@/lib/rubric/day-view';
import { factsHash, isReflectionStale, reflectionFacts, quoted } from '@/lib/rubric/facts';
import { sameFood } from '@/lib/rubric/names';
import { restrictionHits } from '@/lib/rubric/restrictions';
import { sevenDaySummary } from '@/lib/rubric/seven-day';
import { dayInput, eaten, fi, meal, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

describe('sameFood', () => {
  it('normalises spelling and digits, matches alternatives, never a related food', () => {
    expect(
      sameFood(
        { originalName: 'نان سنگك', englishLabel: 'Sangak' },
        { originalName: 'نان سنگک', englishLabel: 'sangak bread' },
      ),
    ).toBe(true);
    expect(
      sameFood(
        { originalName: 'مرغ', englishLabel: 'chicken' },
        { originalName: 'مرغ سوخاری', englishLabel: 'fried chicken' },
      ),
    ).toBe(false);
    expect(
      sameFood(
        { originalName: 'همبرگر خانگی', englishLabel: 'homemade burger' },
        {
          originalName: 'کباب تابه‌ای',
          englishLabel: 'kabab tabei',
          alternatives: [{ originalName: 'همبرگر خانگی', englishLabel: 'homemade burger' }],
        },
      ),
    ).toBe(true);
  });
});

describe('restrictionHits', () => {
  it('names the item that contains a restriction, by normalised token', () => {
    const items = [
      fi('گردو', 'walnuts', 15, 'g', 'NUTS'),
      fi('کیک گردویی', 'walnut cake', 1, 'piece', 'OTHER'),
      fi('ماست', 'yogurt', 100, 'g', 'DAIRY'),
    ];
    const hits = restrictionHits(items, [
      { original: 'Walnuts', normalized: 'walnuts' },
      { original: 'گردو', normalized: 'گردو' },
    ]);
    expect(hits.map((h) => h.item.englishLabel)).toEqual(['walnuts', 'walnut cake']);
    expect(restrictionHits(items, [{ original: '', normalized: '' }])).toEqual([]);
  });
});

describe('reflection facts and staleness', () => {
  const build = (matchedLunch: boolean, skipRest = true) => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[0];
    const items = matchedLunch
      ? opt.items.filter((i) => i.quantity !== null).map((i) => eaten(i))
      : [fi('پیتزا', 'pizza', 2, 'piece', 'OTHER', 600)];
    const yesterday = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(p.lunch.id, opt.id, '13:00', items),
          meal(p.breakfast.id, p.breakfast.options[0].id, '09:00', [
            eaten(p.breakfast.options[0].items[1], 120),
          ]),
        ],
        // Every other slot skipped: a fully accounted day, so the energy total is real.
        skippedSlotIds: skipRest ? [p.snack1.id, p.snack2.id, p.dinner.id] : [p.snack1.id],
        targets: [range(300, 400)],
      }),
    );
    return { p, yesterday };
  };

  it('produces facts with signatures; a match-status change is stale, a note edit is not (TS-§21.13)', () => {
    const { p, yesterday } = build(true);
    const facts = reflectionFacts(yesterday, p.slots, null, {
      greetingName: 'Sara',
      timeOfDay: 'MORNING',
      hasPlan: true,
      isFirstDay: false,
    });
    const lunchFact = facts.find((f) => f.id === `slot:${p.lunch.id}`)!;
    expect(lunchFact.text).toContain('ناهار matched the plan.');
    expect(facts.some((f) => f.kind === 'PORTION')).toBe(true);
    expect(facts.some((f) => f.id === 'today:next')).toBe(true);
    expect(facts.find((f) => f.kind === 'ENERGY')?.signature).toBe('ABOVE:LARGE');

    const changed = reflectionFacts(build(false).yesterday, p.slots, null, {
      greetingName: 'Sara',
      timeOfDay: 'MORNING',
      hasPlan: true,
      isFirstDay: false,
    });
    expect(isReflectionStale(facts, changed, [lunchFact.id])).toBe(true);
    expect(isReflectionStale(facts, changed, ['coverage', 'today:plan'])).toBe(false);
    expect(isReflectionStale(facts, facts, [lunchFact.id])).toBe(false);
    expect(isReflectionStale(facts, changed, ['unknown-id'])).toBe(false);
    expect(factsHash(facts)).not.toBe(factsHash(changed));
  });

  it('withholds the energy fact on a day complete by default, keeping coverage (O risk 5)', () => {
    const { p, yesterday } = build(true, false);
    expect(yesterday.score.completeByDefault).toBe(true);
    expect(yesterday.dailyEnergy).not.toBeNull();
    const facts = reflectionFacts(yesterday, p.slots, null, {
      greetingName: 'Sara',
      timeOfDay: 'MORNING',
      hasPlan: true,
      isFirstDay: false,
    });
    expect(facts.some((f) => f.kind === 'ENERGY')).toBe(false);
    expect(facts.find((f) => f.id === 'coverage')?.text).toContain('(some slots have no record)');
  });

  it('covers the empty, no-plan, unchecked and today-context states', () => {
    const p = buildMenuPlan();
    const empty = computeDayView(dayInput(p.slots, { meals: [], hasRecord: false }));
    const facts = reflectionFacts(empty, [], null, {
      greetingName: 'demo',
      timeOfDay: 'EVENING',
      hasPlan: false,
      isFirstDay: true,
    });
    expect(facts.find((f) => f.id === 'coverage')?.signature).toBe('EMPTY');
    expect(facts.find((f) => f.id === 'today:plan')?.signature).toBe('NO_PLAN');

    const unchecked = computeDayView(
      dayInput(p.slots, {
        meals: [meal(p.breakfast.id, null, null, [fi('چای', 'tea', 1, 'glass', 'OTHER', 30)])],
        logComplete: false,
      }),
    );
    const today = computeDayView(
      dayInput(p.slots, {
        dayPhase: 'ONGOING',
        meals: [meal(p.breakfast.id, p.breakfast.options[0].id, '08:00', [])],
      }),
    );
    const f2 = reflectionFacts(unchecked, p.slots, today, {
      greetingName: 'demo',
      timeOfDay: 'AFTERNOON',
      hasPlan: true,
      isFirstDay: false,
    });
    expect(f2.find((f) => f.id === 'completeness')?.signature).toBe('false');
    // Tea overlaps no breakfast option: a different food under the slot, not a choice owed (B3).
    expect(f2.find((f) => f.id === `slot:${p.breakfast.id}`)?.signature).toBe('DIFFERENT_FOOD:');
    expect(f2.find((f) => f.id === 'today:next')?.signature).toBe(p.snack1.id);
    expect(f2.find((f) => f.id === 'today:recorded')?.signature).toBe('1');
    const skippedAndMissing = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(p.dinner.id, p.dinner.options[1].id, '21:00', [eaten(p.dinner.options[1].items[0])]),
        ],
        skippedSlotIds: [p.snack2.id],
      }),
    );
    const f3 = reflectionFacts(skippedAndMissing, p.slots, null, {
      greetingName: 'x',
      timeOfDay: 'MORNING',
      hasPlan: true,
      isFirstDay: false,
    });
    expect(f3.find((f) => f.id === `slot:${p.snack2.id}`)?.signature).toBe('SKIPPED');
    expect(f3.find((f) => f.id === `slot:${p.dinner.id}`)?.signature).toBe(
      'PARTLY_MATCHED:MISSING',
    );
    expect(quoted({ originalName: 'ناهار', englishLabel: 'Lunch' })).toBe('ناهار');
    expect(quoted({ originalName: ' ', englishLabel: 'Lunch' })).toBe('Lunch');
  });
});

describe('sevenDaySummary', () => {
  const makeDays = (variant: 'different' | 'portion' | 'order' | 'energy' | 'matched' | 'few') => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[0];
    const full = () => opt.items.filter((i) => i.quantity !== null).map((i) => eaten(i));
    // Only the slots each variant needs, so skips never dominate the priority order.
    const slots = variant === 'order' ? [p.breakfast, p.lunch] : [p.lunch];
    const days = [];
    for (let d = 0; d < 4; d += 1) {
      const meals = [];
      if (variant === 'different')
        meals.push(
          meal(p.lunch.id, opt.id, '13:00', [fi('پیتزا', 'pizza', 1, 'piece', 'OTHER', 700)]),
        );
      else if (variant === 'portion')
        meals.push(
          meal(p.lunch.id, opt.id, '13:00', [
            eaten(opt.items[0], 250),
            eaten(opt.items[1]),
            eaten(opt.items[3]),
          ]),
        );
      else if (variant === 'order') {
        meals.push(meal(p.lunch.id, opt.id, '13:00', full()));
        meals.push(
          meal(
            p.breakfast.id,
            p.breakfast.options[0].id,
            '14:00',
            p.breakfast.options[0].items.filter((i) => i.quantity !== null).map((i) => eaten(i)),
          ),
        );
      } else meals.push(meal(p.lunch.id, opt.id, '13:00', full()));
      days.push(
        computeDayView(
          dayInput(slots, {
            localDate: `2026-09-1${d}`,
            meals,
            targets: variant === 'energy' ? [range(100, 200)] : [],
            dayPhase: variant === 'few' && d < 2 ? 'ONGOING' : 'PAST',
          }),
        ),
      );
    }
    return days;
  };

  it('needs three complete days, then reports the most frequent difference by priority', () => {
    expect(sevenDaySummary(makeDays('few'))).toMatchObject({ kind: 'NOT_ENOUGH', completeDays: 2 });
    expect(sevenDaySummary(makeDays('different'))).toMatchObject({
      kind: 'SLOT_DIFFERENT',
      days: 4,
      completeDays: 4,
      slot: { englishLabel: 'Lunch' },
    });
    expect(sevenDaySummary(makeDays('portion'))).toMatchObject({
      kind: 'PORTION',
      direction: 'MORE',
      item: { englishLabel: 'rice' },
    });
    expect(sevenDaySummary(makeDays('order'))).toMatchObject({ kind: 'ORDER' });
    expect(sevenDaySummary(makeDays('energy'))).toMatchObject({ kind: 'ENERGY', status: 'ABOVE' });
    expect(sevenDaySummary(makeDays('matched'))).toMatchObject({
      kind: 'MATCHED_MOST',
      slot: { englishLabel: 'Lunch' },
    });
  });

  it('counts incomplete days in the denominators and handles empty complete days', () => {
    const p = buildMenuPlan();
    const days = [0, 1, 2].map((d) =>
      computeDayView(
        dayInput(p.slots, {
          localDate: `2026-09-1${d}`,
          meals: [meal(null, null, '13:00', [fi('چای', 'tea', 1, 'glass', 'OTHER', 30)])],
          logComplete: false,
        }),
      ),
    );
    expect(sevenDaySummary(days)).toMatchObject({
      kind: 'NOT_ENOUGH',
      completeDays: 0,
      incompleteDays: 3,
    });
    const allSkipped = [0, 1, 2].map((d) =>
      computeDayView(
        dayInput(p.slots, {
          localDate: `2026-09-1${d}`,
          meals: [meal(null, null, '13:00', [fi('چای', 'tea', 1, 'glass', 'OTHER', 30)])],
          skippedSlotIds: p.slots.map((s) => s.id),
        }),
      ),
    );
    expect(sevenDaySummary(allSkipped)).toMatchObject({
      kind: 'SLOT_DIFFERENT',
      slot: { englishLabel: 'Breakfast' },
    });
    // Breakfast partly matched every day, no times, no targets: nothing repeated and nothing matched.
    const partly = [0, 1, 2].map((d) =>
      computeDayView(
        dayInput([p.breakfast], {
          localDate: `2026-09-1${d}`,
          meals: [
            meal(p.breakfast.id, p.breakfast.options[0].id, null, [
              eaten(p.breakfast.options[0].items[0]),
            ]),
          ],
        }),
      ),
    );
    expect(sevenDaySummary(partly).kind).toBe('NO_PATTERN');
  });
});
