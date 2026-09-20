import { describe, expect, it } from 'vitest';
import { parseNumber, renamed, withQuantity } from '@/components/product/plan-review/helpers';
import { draftItemSchema, type DraftItem } from '@/lib/validations/plan';

const item = (overrides: Partial<DraftItem> = {}): DraftItem =>
  draftItemSchema.parse({
    key: 'i1',
    originalName: 'برنج',
    englishLabel: 'rice',
    quantity: null,
    unit: null,
    ...overrides,
  });

describe('renamed', () => {
  it('makes a hand-typed name its own English label, on slots and items', () => {
    expect(renamed({ originalName: 'برنج', englishLabel: 'rice' }, 'برنج قهوه‌ای')).toEqual({
      originalName: 'برنج قهوه‌ای',
      englishLabel: 'برنج قهوه‌ای',
    });
    const slot = { key: 's1', originalName: 'ناهار', englishLabel: 'Lunch', weekday: 7 };
    expect(renamed(slot, 'Post-workout shake')).toMatchObject({
      key: 's1',
      weekday: 7,
      originalName: 'Post-workout shake',
      englishLabel: 'Post-workout shake',
    });
  });
});

describe('withQuantity', () => {
  it('defaults the unit to grams when a quantity is typed with no unit chosen', () => {
    expect(withQuantity(item(), 150)).toMatchObject({
      quantity: 150,
      unit: 'g',
      quantityAssumed: false,
      needsEstimate: true,
    });
  });

  it('keeps a chosen unit and leaves an empty quantity unitless', () => {
    expect(withQuantity(item({ unit: 'slice', unitGrams: 80 }), 2)).toMatchObject({
      quantity: 2,
      unit: 'slice',
      unitGrams: 80,
    });
    expect(withQuantity(item({ quantity: 150, unit: 'g' }), null)).toMatchObject({
      quantity: null,
      unit: 'g',
    });
    expect(withQuantity(item(), null)).toMatchObject({ quantity: null, unit: null });
  });

  it('clears "Assumed" like any hand-typed amount', () => {
    const assumed = item({ quantity: 100, unit: 'g', quantityAssumed: true, needsEstimate: false });
    expect(withQuantity(assumed, parseNumber('۱۵۰'))).toMatchObject({
      quantity: 150,
      quantityAssumed: false,
      needsEstimate: true,
    });
  });
});
