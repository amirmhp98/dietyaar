import { describe, expect, it } from 'vitest';
import { minutesBetween, timeBand } from '@/lib/time';

describe('time bands', () => {
  it('boundaries are inclusive: 60 is SMALL, 120 is NOTICEABLE', () => {
    expect(timeBand(0)).toBe('SMALL');
    expect(timeBand(60)).toBe('SMALL');
    expect(timeBand(-60)).toBe('SMALL');
    expect(timeBand(61)).toBe('NOTICEABLE');
    expect(timeBand(120)).toBe('NOTICEABLE');
    expect(timeBand(121)).toBe('LARGE');
  });

  it('minutesBetween is signed', () => {
    expect(minutesBetween('12:00', '13:25')).toBe(85);
    expect(minutesBetween('13:25', '12:00')).toBe(-85);
  });
});
