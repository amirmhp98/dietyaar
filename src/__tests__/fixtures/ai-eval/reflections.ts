import { computeDayView } from '@/lib/rubric/day-view';
import { reflectionFacts, type ReflectionContext, type ReflectionFact } from '@/lib/rubric/facts';
import { dayInput, eaten, fi, meal, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

/**
 * Every reflection state the product spec § 10 distinguishes, as fact sets
 * for the evaluation harness. `expectedFactIds` are the ids the paragraph
 * must draw on (a prefix matches `slot:<id>`-style ids).
 */
export interface EvalReflection {
  name: string;
  context: ReflectionContext;
  facts: ReflectionFact[];
  expectedFactIds: string[];
}

function ctx(overrides: Partial<ReflectionContext> = {}): ReflectionContext {
  return {
    greetingName: 'Sara',
    timeOfDay: 'MORNING',
    hasPlan: true,
    isFirstDay: false,
    ...overrides,
  };
}

export function buildEvalReflections(): EvalReflection[] {
  const p = buildMenuPlan();
  const lunchOption = p.lunch.options[0];
  const matchedLunch = lunchOption.items.filter((i) => i.quantity !== null).map((i) => eaten(i));

  const goodDay = computeDayView(
    dayInput(p.slots, {
      meals: [
        meal(p.breakfast.id, p.breakfast.options[0].id, '08:30', [
          eaten(p.breakfast.options[0].items[0]),
          eaten(p.breakfast.options[0].items[1]),
        ]),
        meal(p.lunch.id, lunchOption.id, '13:00', matchedLunch),
        meal(p.dinner.id, p.dinner.options[0].id, '20:00', [eaten(p.dinner.options[0].items[0])]),
      ],
      skippedSlotIds: [p.snack1.id, p.snack2.id],
      targets: [range(1900, 2200)],
    }),
  );

  const offPlanDay = computeDayView(
    dayInput(p.slots, {
      meals: [
        meal(p.lunch.id, null, '14:30', [fi('پیتزا', 'pizza', 2, 'piece', 'OTHER', 600)]),
        meal(null, null, '17:00', [fi('کیک', 'cake', 1, 'piece', 'OTHER', 350)]),
      ],
      targets: [range(1900, 2200)],
    }),
  );

  const unchecked = computeDayView(
    dayInput(p.slots, {
      meals: [meal(p.breakfast.id, null, '09:00', [fi('چای', 'tea', 1, 'glass', 'OTHER', 30)])],
      logComplete: false,
    }),
  );

  const empty = computeDayView(dayInput(p.slots, { meals: [], hasRecord: false }));

  const today = computeDayView(
    dayInput(p.slots, {
      dayPhase: 'ONGOING',
      meals: [meal(p.breakfast.id, p.breakfast.options[0].id, '08:00', [])],
    }),
  );

  return [
    {
      name: 'first day, no plan',
      context: ctx({ hasPlan: false, isFirstDay: true }),
      facts: reflectionFacts(null, [], null, ctx({ hasPlan: false, isFirstDay: true })),
      expectedFactIds: ['today:plan'],
    },
    {
      name: 'yesterday matched the plan',
      context: ctx(),
      facts: reflectionFacts(goodDay, p.slots, null, ctx()),
      expectedFactIds: ['coverage', 'slot:'],
    },
    {
      name: 'yesterday off plan with an extra meal',
      context: ctx(),
      facts: reflectionFacts(offPlanDay, p.slots, null, ctx()),
      expectedFactIds: ['coverage'],
    },
    {
      name: 'yesterday not checked as complete',
      context: ctx(),
      facts: reflectionFacts(unchecked, p.slots, null, ctx()),
      expectedFactIds: ['completeness'],
    },
    {
      name: 'nothing recorded yesterday',
      context: ctx(),
      facts: reflectionFacts(empty, p.slots, null, ctx()),
      expectedFactIds: ['coverage'],
    },
    {
      name: 'afternoon with today context',
      context: ctx({ timeOfDay: 'AFTERNOON' }),
      facts: reflectionFacts(goodDay, p.slots, today, ctx({ timeOfDay: 'AFTERNOON' })),
      expectedFactIds: ['today:'],
    },
  ];
}
