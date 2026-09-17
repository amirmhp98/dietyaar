import { describe, expect, it } from 'vitest';
import { computeDayView } from '@/lib/rubric/day-view';
import { factsHash, isReflectionStale, reflectionFacts, quoted } from '@/lib/rubric/facts';
import { sameFood } from '@/lib/rubric/names';
import { restrictionHits } from '@/lib/rubric/restrictions';
import { ruleObservation, type RuleDay } from '@/lib/rubric/rules';
import { sevenDaySummary } from '@/lib/rubric/seven-day';
import type { RubricRule } from '@/lib/rubric/types';
import { dayInput, eaten, fi, meal, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

const ruleDay = (items: ReturnType<typeof fi>[][], complete = true, weekday = 2): RuleDay => ({
  localDate: '2026-09-15',
  items: items.flat(),
  mealItems: items,
  logComplete: true,
  complete,
  weekday,
});

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

describe('ruleObservation', () => {
  const fish = fi('ماهی', 'fish', 150, 'g', 'MEAT', 250);
  const chicken = fi('مرغ', 'chicken', 120, 'g', 'MEAT', 200);
  const serving: RubricRule = {
    id: 'r1',
    kind: 'SERVING_COUNT',
    tracking: 'TRACK',
    period: 'WEEK',
    definition: {
      food: { originalName: 'ماهی', englishLabel: 'fish', synonyms: [] },
      count: 2,
      comparator: 'AT_LEAST',
    },
    originalText: 'ماهی دو بار در هفته',
  };

  it('counts one serving per recorded meal, progress then final status', () => {
    const twoInOneMeal = ruleObservation(serving, [ruleDay([[fish, fish]])], false);
    expect(twoInOneMeal).toMatchObject({ status: 'PROGRESS', count: 1, required: 2 });
    const met = ruleObservation(serving, [ruleDay([[fish]]), ruleDay([[fish]])], true);
    expect(met.status).toBe('MET');
    expect(ruleObservation(serving, [ruleDay([[fish]]), ruleDay([[chicken]])], true).status).toBe(
      'NOT_MET',
    );
    expect(
      ruleObservation(serving, [ruleDay([[fish]]), ruleDay([[chicken]], false)], true).status,
    ).toBe('INCOMPLETE');
    const atMost = {
      ...serving,
      definition: { ...(serving.definition as object), comparator: 'AT_MOST', count: 1 },
    };
    expect(ruleObservation(atMost, [ruleDay([[fish], [fish]])], false).status).toBe('NOT_MET');
    const exact = {
      ...serving,
      definition: { ...(serving.definition as object), comparator: 'EXACT', count: 1 },
    };
    expect(ruleObservation(exact, [ruleDay([[fish]])], true).status).toBe('MET');
  });

  it('distinct groups count each group once, from category and confirmed memberships', () => {
    const rule: RubricRule = {
      id: 'r2',
      kind: 'DISTINCT_GROUPS',
      tracking: 'TRACK',
      period: 'DAY',
      definition: { groups: ['FRUIT', 'DAIRY', 'NUTS'], minimum: 2 },
      originalText: '',
    };
    const apple = fi('سیب', 'apple', 1, 'medium_apple', 'FRUIT', 95);
    const apple2 = fi('سیب', 'apple', 1, 'medium_apple', 'FRUIT', 95);
    const custom = fi('کشک', 'kashk', 30, 'g', 'OTHER', 60, { ruleGroups: ['DAIRY'] });
    expect(ruleObservation(rule, [ruleDay([[apple, apple2]])], true)).toMatchObject({
      status: 'NOT_MET',
      count: 1,
      required: 2,
    });
    expect(ruleObservation(rule, [ruleDay([[apple, custom]])], true)).toMatchObject({
      status: 'MET',
      count: 2,
    });
    expect(ruleObservation(rule, [ruleDay([[apple]])], false).status).toBe('PROGRESS');
  });

  it('named weekday food observes, exclusion flags, instructions stay notes', () => {
    const named: RubricRule = {
      id: 'r3',
      kind: 'NAMED_WEEKDAY_FOOD',
      tracking: 'TRACK',
      period: 'WEEK',
      definition: { weekday: 2, food: { originalName: 'ماهی', englishLabel: 'fish' } },
      originalText: '',
    };
    expect(ruleObservation(named, [ruleDay([[fish]], true, 2)], false).status).toBe('MET');
    expect(ruleObservation(named, [ruleDay([[chicken]], true, 2)], false).status).toBe('NOT_MET');
    expect(ruleObservation(named, [ruleDay([[chicken]], false, 2)], true).status).toBe(
      'INCOMPLETE',
    );
    expect(ruleObservation(named, [ruleDay([[chicken]], false, 3)], false).status).toBe('PROGRESS');
    const exclusion: RubricRule = {
      id: 'r4',
      kind: 'EXCLUSION',
      tracking: 'TRACK',
      period: 'DAY',
      definition: { foods: [{ originalName: 'مرغ سوخاری', englishLabel: 'fried chicken' }] },
      originalText: '',
    };
    expect(ruleObservation(exclusion, [ruleDay([[chicken]])], true).status).toBe('MET');
    expect(
      ruleObservation(
        exclusion,
        [ruleDay([[fi('مرغ سوخاری', 'fried chicken', 1, 'piece', 'MEAT', 300)]])],
        false,
      ).status,
    ).toBe('FLAGGED');
    expect(ruleObservation(exclusion, [ruleDay([[chicken]], false)], true).status).toBe(
      'INCOMPLETE',
    );
    const note: RubricRule = {
      id: 'r5',
      kind: 'INSTRUCTION',
      tracking: 'TRACK',
      period: null,
      definition: {},
      originalText: '',
    };
    expect(ruleObservation(note, [], false).status).toBe('NOTE');
    expect(ruleObservation({ ...serving, definition: {} }, [], false).status).toBe('NOTE');
    expect(ruleObservation({ ...named, definition: {} }, [], false).status).toBe('NOTE');
    expect(
      ruleObservation({ ...exclusion, kind: 'DISTINCT_GROUPS', definition: {} }, [], false).status,
    ).toBe('NOTE');
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
  const build = (matchedLunch: boolean) => {
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
        skippedSlotIds: [p.snack1.id],
        targets: [range(300, 400)],
        rules: [
          {
            id: 'r',
            kind: 'EXCLUSION',
            tracking: 'TRACK',
            period: 'DAY',
            definition: { foods: [] },
            originalText: '',
          },
        ],
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
    expect(lunchFact.text).toContain('ناهار (Lunch) matched the plan.');
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
    expect(f2.find((f) => f.id === `slot:${p.breakfast.id}`)?.signature).toBe('NEEDS_REVIEW');
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
    expect(quoted({ originalName: 'Lunch', englishLabel: 'Lunch' })).toBe('Lunch');
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
