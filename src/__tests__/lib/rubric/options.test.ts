import { describe, expect, it } from 'vitest';
import { optionNumber, sortedOptions } from '@/lib/rubric/options';

const slot = {
  options: [
    { id: 'c', position: 2, label: 'گزینه ۳' },
    { id: 'a', position: 0, label: 'گزینه ۱' },
    { id: 'b', position: 1, label: null },
  ],
};

describe('optionNumber', () => {
  it('numbers options by plan position, not array order or the pasted heading', () => {
    expect(sortedOptions(slot).map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(optionNumber(slot, 'a')).toBe(1);
    expect(optionNumber(slot, 'b')).toBe(2);
    expect(optionNumber(slot, 'c')).toBe(3);
  });

  it('is null for no option or an option of another slot', () => {
    expect(optionNumber(slot, null)).toBeNull();
    expect(optionNumber(slot, undefined)).toBeNull();
    expect(optionNumber(slot, 'zz')).toBeNull();
    expect(optionNumber({ options: [] }, 'a')).toBeNull();
  });
});
