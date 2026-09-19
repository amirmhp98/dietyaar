import { describe, expect, it } from 'vitest';
import { circularMinutesBetween, minutesBetween, timeBand } from '@/lib/time';

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

  it('circularMinutesBetween wraps at midnight into (−720, 720]', () => {
    expect(circularMinutesBetween('12:00', '13:25')).toBe(85);
    expect(circularMinutesBetween('13:25', '12:00')).toBe(-85);
    expect(circularMinutesBetween('21:00', '00:30')).toBe(210);
    expect(circularMinutesBetween('00:30', '21:00')).toBe(-210);
    expect(circularMinutesBetween('23:59', '00:00')).toBe(1);
    // Exactly half a day is "after"; one minute more is "before".
    expect(circularMinutesBetween('00:00', '12:00')).toBe(720);
    expect(circularMinutesBetween('12:00', '00:00')).toBe(720);
    expect(circularMinutesBetween('00:00', '12:01')).toBe(-719);
    expect(circularMinutesBetween('09:00', '09:00')).toBe(0);
  });
});
