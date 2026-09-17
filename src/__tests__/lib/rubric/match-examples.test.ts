import { describe, expect, it } from 'vitest';
import { computeDayView } from '@/lib/rubric/day-view';
import { bestOption, matchSlot } from '@/lib/rubric/match-slot';
import { dayInput, eaten, fi, meal } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

/** Product spec § 8 worked examples on the menu plan. */
describe('menu plan matching', () => {
  it('option chosen with prescribed amounts → Matched, food 50, portion 30', () => {
    const p = buildMenuPlan();
    const opt2 = p.breakfast.options[1];
    const items = opt2.items.map((i) => eaten(i));
    const view = computeDayView(
      dayInput(p.slots, { meals: [meal(p.breakfast.id, opt2.id, '08:30', items)] }),
    );
    const b = view.slots[0];
    expect(b.state).toBe('RECORDED');
    expect(b.match?.status).toBe('MATCHED');
    expect(b.score?.food).toBe(1);
    expect(b.score?.portion).toBe(1);
    expect(b.score?.excluded).toEqual(['TIMING']); // single recorded meal: no order reference
    expect(b.score?.score).toBe(100);
  });

  it('mixed options → Partly matched · items from two options; food 25', () => {
    const p = buildMenuPlan();
    const [opt1, opt2] = p.breakfast.options;
    const items = [eaten(opt1.items[0]), eaten(opt2.items[1])]; // eggs + Greek yogurt
    const m = matchSlot(items, opt1, p.breakfast, p.slots);
    expect(m.status).toBe('PARTLY_MATCHED');
    expect(m.reason).toBe('MIXED');
    expect(m.mixed).toBe(true);
  });

  it('added burger → Partly matched · Added: burger; extra cucumber keeps Matched', () => {
    const p = buildMenuPlan();
    const opt1 = p.breakfast.options[0];
    const base = opt1.items.map((i) => eaten(i));
    const withBurger = matchSlot(
      [...base, fi('همبرگر خانگی', 'homemade burger', 1, 'piece', 'MEAT', 350)],
      opt1,
      p.breakfast,
      p.slots,
    );
    expect(withBurger.status).toBe('PARTLY_MATCHED');
    expect(withBurger.reason).toBe('ADDED');
    expect(withBurger.added.map((a) => a.englishLabel)).toEqual(['homemade burger']);
    const withCucumber = matchSlot(
      [...base, fi('خیار', 'cucumber', 1, 'medium_cucumber', 'VEGETABLE', 15)],
      opt1,
      p.breakfast,
      p.slots,
    );
    expect(withCucumber.status).toBe('MATCHED');
  });

  it('replacement under lunch → Different food; extra under Other → lunch Matched, sandwich in nutrition only', () => {
    const p = buildMenuPlan();
    const sandwich = fi('ساندویچ', 'sandwich', 1, 'piece', 'OTHER', 450);
    const replaced = computeDayView(
      dayInput(p.slots, { meals: [meal(p.lunch.id, p.lunch.options[0].id, '13:00', [sandwich])] }),
    );
    expect(replaced.slots[2].match?.status).toBe('DIFFERENT_FOOD');
    expect(replaced.slots[2].score?.food).toBe(0);

    const opt1 = p.lunch.options[0];
    const extra = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(
            p.lunch.id,
            opt1.id,
            '13:00',
            opt1.items.map((i) => eaten(i)),
          ),
          meal(null, null, '17:00', [sandwich]),
        ],
      }),
    );
    expect(extra.slots[2].match?.status).toBe('MATCHED');
    expect(extra.otherMealIds).toHaveLength(1);
    const energy = extra.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')!;
    expect(energy.subtotal.value).toBe(195 + 200 + 40 + 450);
  });

  it('cross-slot: lunch option 4 at dinner → Partly matched · this is a lunch option; lunch stays not recorded', () => {
    const p = buildMenuPlan();
    const lunch4 = p.lunch.options[3];
    const view = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(
            p.dinner.id,
            p.dinner.options[0].id,
            '21:00',
            lunch4.items.map((i) => eaten(i)),
          ),
        ],
      }),
    );
    const dinner = view.slots[4];
    expect(dinner.match?.status).toBe('PARTLY_MATCHED');
    expect(dinner.match?.reason).toBe('CROSS_SLOT');
    expect(dinner.match?.crossSlot?.englishLabel).toBe('Lunch');
    expect(view.slots[2].state).toBe('NOT_RECORDED');
  });

  it('a meal saved under Other is never matched to a slot', () => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[3];
    const view = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(
            null,
            null,
            '13:00',
            opt.items.map((i) => eaten(i)),
          ),
        ],
      }),
    );
    expect(view.slots.every((s) => s.state === 'NOT_RECORDED')).toBe(true);
    expect(view.otherMealIds).toHaveLength(1);
  });

  it('fewer than half of the counted items → Different food; in-item alternatives count as present', () => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[0]; // rice, chicken, (salad), oil → 3 counted
    expect(matchSlot([eaten(opt.items[0])], opt, p.lunch, p.slots).status).toBe('DIFFERENT_FOOD');
    const half = matchSlot([eaten(opt.items[0]), eaten(opt.items[1])], opt, p.lunch, p.slots);
    expect(half.status).toBe('PARTLY_MATCHED');
    expect(half.reason).toBe('MISSING');
    expect(half.missing.map((m) => m.englishLabel)).toEqual(['olive oil']);
  });

  it('bestOption picks the option with the highest item overlap', () => {
    const p = buildMenuPlan();
    const opt4 = p.lunch.options[3];
    expect(
      bestOption(
        opt4.items.slice(0, 2).map((i) => eaten(i)),
        p.lunch,
      )?.id,
    ).toBe(opt4.id);
  });
});
