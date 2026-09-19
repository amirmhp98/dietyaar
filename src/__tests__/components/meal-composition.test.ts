import { describe, expect, it } from 'vitest';
import {
  OTHER_SLOT,
  defaultLinkAfterAnalysis,
  seedManualItem,
  timeMissing,
} from '@/components/product/meal/composition';
import { quantityFromChoice } from '@/components/product/meal/questions';
import { draftItem } from '@/__tests__/factories';

describe('quantityFromChoice (B2)', () => {
  const bread = draftItem({
    key: 'b',
    unit: 'slice_sangak',
    quantity: null,
    quantityUnknown: true,
  });
  const stew = draftItem({ key: 's', unit: null, quantity: null, quantityUnknown: true });

  it.each([
    ['2 slices', bread, { quantity: 2, unit: 'slice_sangak' }],
    ['1 slice', bread, { quantity: 1, unit: 'slice_sangak' }],
    ['3 slices', stew, null],
    ['2 slices of sangak', stew, { quantity: 2, unit: 'slice_sangak' }],
    ['a medium bowl', stew, { quantity: 1, unit: 'bowl' }],
    ['a small bowl', stew, { quantity: 1, unit: 'bowl' }],
    ['half a bowl', stew, { quantity: 0.5, unit: 'bowl' }],
    ['a quarter of a bowl', stew, { quantity: 0.25, unit: 'bowl' }],
    ['two glasses', stew, { quantity: 2, unit: 'glass' }],
    ['a glass', stew, { quantity: 1, unit: 'glass' }],
    ['1 cup', stew, { quantity: 1, unit: 'cup' }],
    ['2 cups', stew, { quantity: 2, unit: 'cup' }],
    ['1 tbsp', stew, { quantity: 1, unit: 'tbsp' }],
    ['2 tablespoons', stew, { quantity: 2, unit: 'tbsp' }],
    ['1 tsp', stew, { quantity: 1, unit: 'tsp' }],
    ['3 teaspoons', stew, { quantity: 3, unit: 'tsp' }],
    ['80 g', stew, { quantity: 80, unit: 'g' }],
    ['100 grams', stew, { quantity: 100, unit: 'g' }],
    ['250 ml', stew, { quantity: 250, unit: 'ml' }],
    ['2 pieces', stew, { quantity: 2, unit: 'piece' }],
    ['one serving', stew, { quantity: 1, unit: 'serving' }],
    ['a handful', stew, { quantity: 1, unit: 'handful' }],
    ['۲ عدد', stew, null],
    ['a small portion', stew, null],
    ['a medium portion', stew, null],
    ['a large portion', stew, null],
    ['all of it', stew, null],
    ['about a quarter', stew, null],
    ['half', stew, null],
    ['1.5 cups', stew, { quantity: 1.5, unit: 'cup' }],
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
