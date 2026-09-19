import { describe, expect, it } from 'vitest';
import { optionRequiredFor } from '@/lib/rubric/match-slot';
import { eaten, fi } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';

/** Product spec § 7 option rule as rewritten by improvement plan B3. */
describe('optionRequiredFor', () => {
  it('is false for a single-option slot whatever the items', () => {
    const p = buildMenuPlan();
    const [only] = p.dinner.options;
    expect(p.dinner.options.length).toBeGreaterThan(1);
    const single = { ...p.dinner, options: [only] };
    expect(optionRequiredFor([eaten(only.items[0])], single)).toBe(false);
    expect(optionRequiredFor([], single)).toBe(false);
  });

  it('is true when an item is a counted item of any option of the slot', () => {
    const p = buildMenuPlan();
    const rice = eaten(p.lunch.options[0].items[0]);
    expect(optionRequiredFor([rice], p.lunch)).toBe(true);
    // Name match without a matchedPlanItemId counts too.
    const bread = fi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210);
    expect(optionRequiredFor([bread], p.lunch)).toBe(true);
  });

  it('is false when nothing overlaps: a burger under Lunch is a different food, no option owed', () => {
    const p = buildMenuPlan();
    const burger = fi('ساندویچ همبرگر', 'burger sandwich', 1, 'piece', 'MEAT', 450);
    expect(optionRequiredFor([burger], p.lunch)).toBe(false);
    expect(optionRequiredFor([], p.lunch)).toBe(false);
  });

  it('always requires the option for a prefilled ("I ate this") meal under a multi-option slot', () => {
    const p = buildMenuPlan();
    const burger = fi('ساندویچ همبرگر', 'burger sandwich', 1, 'piece', 'MEAT', 450);
    expect(optionRequiredFor([burger], p.lunch, true)).toBe(true);
    expect(optionRequiredFor([], p.lunch, true)).toBe(true);
    const single = { ...p.dinner, options: [p.dinner.options[0]] };
    expect(optionRequiredFor([], single, true)).toBe(false);
  });

  it('never counts raw vegetables or herbs listed without a quantity', () => {
    const p = buildMenuPlan();
    const salad = fi('سالاد بزرگ', 'large salad', null, null, 'VEGETABLE');
    const herbs = fi('سبزی خوردن', 'fresh herbs', null, null, 'HERB');
    expect(optionRequiredFor([salad, herbs], p.lunch)).toBe(false);
  });
});
