import { describe, expect, it } from 'vitest';
import {
  OTHER_SLOT,
  composeLayout,
  defaultLinkAfterAnalysis,
  sanitizeItems,
  seedManualItem,
  timeMissing,
} from '@/components/product/meal/composition';
import { quantityFromChoice } from '@/components/product/meal/questions';
import { draftItem } from '@/__tests__/factories';

describe('quantityFromChoice (B2)', () => {
  const bread = draftItem({
    key: 'b',
    unit: 'slice',
    unitGrams: 80,
    quantity: null,
    quantityUnknown: true,
  });
  const stew = draftItem({ key: 's', unit: null, quantity: null, quantityUnknown: true });

  it.each([
    ['2 slices', bread, { quantity: 2, unit: 'slice', unitGrams: 80 }],
    ['1 slice', bread, { quantity: 1, unit: 'slice', unitGrams: 80 }],
    ['3 slices', stew, { quantity: 3, unit: 'slice', unitGrams: null }],
    ['2 slices of sangak', stew, { quantity: 2, unit: 'slice', unitGrams: null }],
    ['a medium bowl', stew, { quantity: 1, unit: 'bowl', unitGrams: null }],
    ['a small bowl', stew, { quantity: 1, unit: 'bowl', unitGrams: null }],
    ['half a bowl', stew, { quantity: 0.5, unit: 'bowl', unitGrams: null }],
    ['a quarter of a bowl', stew, { quantity: 0.25, unit: 'bowl', unitGrams: null }],
    ['two glasses', stew, { quantity: 2, unit: 'glass', unitGrams: null }],
    ['a glass', stew, { quantity: 1, unit: 'glass', unitGrams: null }],
    ['1 cup', stew, { quantity: 1, unit: 'cup', unitGrams: null }],
    ['2 cups', stew, { quantity: 2, unit: 'cup', unitGrams: null }],
    ['1 tbsp', stew, { quantity: 1, unit: 'tbsp', unitGrams: null }],
    ['2 tablespoons', stew, { quantity: 2, unit: 'tbsp', unitGrams: null }],
    ['1 tsp', stew, { quantity: 1, unit: 'tsp', unitGrams: null }],
    ['3 teaspoons', stew, { quantity: 3, unit: 'tsp', unitGrams: null }],
    ['80 g', stew, { quantity: 80, unit: 'g', unitGrams: null }],
    ['100 grams', stew, { quantity: 100, unit: 'g', unitGrams: null }],
    ['250 ml', stew, { quantity: 250, unit: 'ml', unitGrams: null }],
    ['2 pieces', stew, { quantity: 2, unit: 'piece', unitGrams: null }],
    ['one serving', stew, { quantity: 1, unit: 'serving', unitGrams: null }],
    ['a handful', stew, { quantity: 1, unit: 'handful', unitGrams: null }],
    ['۲ عدد', stew, null],
    ['a small portion', stew, null],
    ['a medium portion', stew, null],
    ['a large portion', stew, null],
    ['all of it', stew, null],
    ['about a quarter', stew, null],
    ['half', stew, null],
    ['1.5 cups', stew, { quantity: 1.5, unit: 'cup', unitGrams: null }],
  ])('%s → %j', (choice, item, expected) => {
    expect(quantityFromChoice(choice, item)).toEqual(expected);
  });
});

describe('defaultLinkAfterAnalysis (B4)', () => {
  it("keeps the user's own choice, Other included", () => {
    expect(
      defaultLinkAfterAnalysis({
        userChoice: 'slot-lunch',
        suggestedSlotId: 'slot-dinner',
        recordedSlotIds: ['slot-lunch'],
      }),
    ).toEqual({ slotChoice: 'slot-lunch', extraSlotId: null });
    expect(
      defaultLinkAfterAnalysis({
        userChoice: OTHER_SLOT,
        suggestedSlotId: 'slot-dinner',
        recordedSlotIds: [],
      }),
    ).toEqual({ slotChoice: OTHER_SLOT, extraSlotId: null });
  });

  it('takes the suggestion when the slot is free', () => {
    expect(
      defaultLinkAfterAnalysis({
        userChoice: null,
        suggestedSlotId: 'slot-lunch',
        recordedSlotIds: ['slot-breakfast'],
      }),
    ).toEqual({ slotChoice: 'slot-lunch', extraSlotId: null });
  });

  it('defaults to Extra when nothing is suggested or the suggested slot is already recorded', () => {
    expect(
      defaultLinkAfterAnalysis({ userChoice: null, suggestedSlotId: null, recordedSlotIds: [] }),
    ).toEqual({ slotChoice: OTHER_SLOT, extraSlotId: null });
    expect(
      defaultLinkAfterAnalysis({
        userChoice: null,
        suggestedSlotId: 'slot-snack',
        recordedSlotIds: ['slot-snack'],
      }),
    ).toEqual({ slotChoice: OTHER_SLOT, extraSlotId: 'slot-snack' });
  });
});

describe('timeMissing (B6)', () => {
  it('blocks only an empty time that was not declared unknown', () => {
    expect(timeMissing(null, false)).toBe(true);
    expect(timeMissing('', false)).toBe(true);
    expect(timeMissing(null, true)).toBe(false);
    expect(timeMissing('12:00', false)).toBe(false);
  });
});

describe('seedManualItem (B7)', () => {
  it('keeps the typed text as the first item, unknown quantity, category OTHER', () => {
    const seed = seedManualItem('  دو تا تخم مرغ با نان  ');
    expect(seed).toMatchObject({
      originalName: 'دو تا تخم مرغ با نان',
      englishLabel: 'دو تا تخم مرغ با نان',
      quantityUnknown: true,
      quantity: null,
      category: 'OTHER',
      position: 0,
    });
  });

  it('caps the name at 120 characters and seeds nothing for an empty box', () => {
    expect(seedManualItem('x'.repeat(300))?.originalName).toHaveLength(120);
    expect(seedManualItem('   ')).toBeNull();
  });
});

describe('sanitizeItems', () => {
  it('drops blank names, renumbers positions and fills a missing English label', () => {
    const items = sanitizeItems([
      draftItem({ key: 'a', position: 0, originalName: 'نان', englishLabel: ' ' }),
      draftItem({ key: 'b', position: 1, originalName: '   ' }),
      draftItem({ key: 'c', position: 2, originalName: 'egg', englishLabel: 'boiled egg' }),
    ]);
    expect(items).toMatchObject([
      { key: 'a', position: 0, englishLabel: 'نان' },
      { key: 'c', position: 1, englishLabel: 'boiled egg' },
    ]);
  });
});

describe('composeLayout (D2a)', () => {
  const lunch = { options: [{ id: 'a' }, { id: 'b' }] };
  const single = { options: [{ id: 'a' }] };

  it('opened from a slot row: the option list first, then the text box, Recent only when non-empty', () => {
    expect(composeLayout({ openedSlot: lunch, recentCount: 2 })).toEqual([
      'options',
      'input',
      'recent',
    ]);
    expect(composeLayout({ openedSlot: lunch, recentCount: 0 })).toEqual(['options', 'input']);
    expect(composeLayout({ openedSlot: lunch, recentCount: null })).toEqual(['options', 'input']);
    expect(composeLayout({ openedSlot: single, recentCount: 0 })).toEqual(['options', 'input']);
  });

  it('opened from the button or a History day: the text box first, planned chips, Recent while loading or non-empty', () => {
    expect(composeLayout({ openedSlot: null, recentCount: null })).toEqual([
      'input',
      'planned',
      'recent',
    ]);
    expect(composeLayout({ openedSlot: null, recentCount: 3 })).toEqual([
      'input',
      'planned',
      'recent',
    ]);
    expect(composeLayout({ openedSlot: null, recentCount: 0 })).toEqual(['input', 'planned']);
  });

  it('a slot without options falls back to the text-first layout', () => {
    expect(composeLayout({ openedSlot: { options: [] }, recentCount: 0 })).toEqual([
      'input',
      'planned',
    ]);
  });
});
