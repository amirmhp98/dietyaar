import { describe, expect, it } from 'vitest';
import {
  assignWindows,
  keywordWindow,
  windowOf,
  windowStateAt,
  type WindowSource,
} from '@/lib/rubric/windows';

function src(
  originalName: string,
  englishLabel: string,
  position: number,
  extra: Partial<WindowSource> = {},
): WindowSource {
  return {
    weekday: 7,
    position,
    originalName,
    englishLabel,
    timeStart: null,
    timeEnd: null,
    timeAssumed: false,
    ...extra,
  };
}

const windows = (slots: WindowSource[]) =>
  assignWindows(slots).map((s) => [s.timeStart, s.timeEnd, s.timeAssumed]);

describe('keywordWindow', () => {
  it('matches the English label case-insensitively and the compound names first', () => {
    expect(keywordWindow(src('x', 'Breakfast', 0))).toEqual({ start: '06:00', end: '10:30' });
    expect(keywordWindow(src('x', 'LUNCH', 0))).toEqual({ start: '12:00', end: '15:30' });
    expect(keywordWindow(src('x', 'Dinner', 0))).toEqual({ start: '18:30', end: '23:00' });
    expect(keywordWindow(src('x', 'Morning snack', 0))).toEqual({ start: '10:00', end: '12:30' });
    expect(keywordWindow(src('x', 'First snack', 0))).toEqual({ start: '10:00', end: '12:30' });
    expect(keywordWindow(src('x', 'Afternoon snack', 0))).toEqual({ start: '15:00', end: '18:30' });
    expect(keywordWindow(src('x', 'Second snack', 0))).toEqual({ start: '15:00', end: '18:30' });
    expect(keywordWindow(src('x', 'Pre-workout', 0))).toEqual({ start: '15:00', end: '19:00' });
    expect(keywordWindow(src('x', 'Post-workout meal', 0))).toEqual({
      start: '17:00',
      end: '21:00',
    });
    expect(keywordWindow(src('x', 'Before bed', 0))).toEqual({ start: '21:00', end: '23:30' });
  });

  it('falls back to Persian keywords in the original name, whatever the joiner', () => {
    expect(keywordWindow(src('صبحانه', 'Meal 1', 0))).toEqual({ start: '06:00', end: '10:30' });
    expect(keywordWindow(src('میان‌وعده اول', 'Snack', 0))).toEqual({
      start: '10:00',
      end: '12:30',
    });
    expect(keywordWindow(src('میان وعده دوم', 'Snack', 0))).toEqual({
      start: '15:00',
      end: '18:30',
    });
    expect(keywordWindow(src('ناهار', 'Meal 2', 0))).toEqual({ start: '12:00', end: '15:30' });
    expect(keywordWindow(src('عصرانه', 'Meal', 0))).toEqual({ start: '15:00', end: '18:30' });
    expect(keywordWindow(src('شام', 'Meal 3', 0))).toEqual({ start: '18:30', end: '23:00' });
    expect(keywordWindow(src('قبل تمرین', 'Meal', 0))).toEqual({ start: '15:00', end: '19:00' });
    expect(keywordWindow(src('بعد از تمرین', 'Meal', 0))).toEqual({ start: '17:00', end: '21:00' });
    expect(keywordWindow(src('قبل خواب', 'Meal', 0))).toEqual({ start: '21:00', end: '23:30' });
  });

  it('leaves a bare "snack" and unknown names unrecognised', () => {
    expect(keywordWindow(src('میان‌وعده', 'Snack', 0))).toBeNull();
    expect(keywordWindow(src('وعده ۱', 'Meal 1', 0))).toBeNull();
  });
});

describe('assignWindows', () => {
  it('keeps stated times, assumes the rest from the names and lets windows overlap', () => {
    const slots = [
      src('صبحانه', 'Breakfast', 0),
      src('میان‌وعده اول', 'First snack', 1),
      src('ناهار', 'Lunch', 2, { timeStart: '13:00', timeEnd: '14:00' }),
      src('قبل تمرین', 'Pre-workout', 3),
      src('عصرانه', 'Afternoon snack', 4),
      src('شام', 'Dinner', 5),
    ];
    expect(windows(slots)).toEqual([
      ['06:00', '10:30', true],
      ['10:00', '12:30', true],
      ['13:00', '14:00', false],
      ['15:00', '19:00', true],
      ['15:00', '18:30', true],
      ['18:30', '23:00', true],
    ]);
  });

  it('splits 07:00–22:00 evenly when nothing is recognised, on 5-minute boundaries', () => {
    const four = [1, 2, 3, 4].map((n) => src(`وعده ${n}`, `Meal ${n}`, n - 1));
    expect(windows(four)).toEqual([
      ['07:00', '10:45', true],
      ['10:45', '14:30', true],
      ['14:30', '18:15', true],
      ['18:15', '22:00', true],
    ]);
    const three = [1, 2, 3].map((n) => src(`وعده ${n}`, `Meal ${n}`, n - 1));
    expect(windows(three)).toEqual([
      ['07:00', '12:00', true],
      ['12:00', '17:00', true],
      ['17:00', '22:00', true],
    ]);
  });

  it('places unrecognised slots between their recognised neighbours', () => {
    const slots = [
      src('صبحانه', 'Breakfast', 0),
      src('میان‌وعده', 'Snack', 1),
      src('میان‌وعده', 'Snack', 2),
      src('ناهار', 'Lunch', 3),
      src('وعده', 'Meal', 4),
      src('شام', 'Dinner', 5),
      src('وعده', 'Meal', 6),
    ];
    expect(windows(slots)).toEqual([
      ['06:00', '10:30', true],
      ['10:30', '11:15', true],
      ['11:15', '12:00', true],
      ['12:00', '15:30', true],
      ['15:30', '18:30', true],
      ['18:30', '23:00', true],
      // After dinner the bounds cross (23:00 > 22:00): the whole day.
      ['07:00', '22:00', true],
    ]);
  });

  it('takes the whole day when the neighbours cross', () => {
    const slots = [
      src('قبل تمرین', 'Pre-workout', 0),
      src('وعده', 'Meal', 1),
      src('بعد تمرین', 'Post-workout', 2),
    ];
    expect(windows(slots)[1]).toEqual(['07:00', '22:00', true]);
  });

  it('recomputes an assumed window from the current name and keeps the input order', () => {
    const renamed = src('ناهار', 'Lunch', 0, {
      timeStart: '06:00',
      timeEnd: '10:30',
      timeAssumed: true,
    });
    const [lunch] = assignWindows([renamed]);
    expect([lunch.timeStart, lunch.timeEnd, lunch.timeAssumed]).toEqual(['12:00', '15:30', true]);
    const stated = src('صبحانه', 'Breakfast', 0, { timeStart: '07:30', timeEnd: null });
    expect(assignWindows([stated])[0]).toBe(stated);
  });

  it('assigns weekday plans one day at a time', () => {
    const slots = [
      src('وعده', 'Meal', 0, { weekday: 6 }),
      src('وعده', 'Meal', 1, { weekday: 6 }),
      src('وعده', 'Meal', 0, { weekday: 0 }),
    ];
    expect(windows(slots)).toEqual([
      ['07:00', '14:30', true],
      ['14:30', '22:00', true],
      ['07:00', '22:00', true],
    ]);
  });
});

describe('windowStateAt', () => {
  const lunch = { start: '12:00', end: '15:30', assumed: true };

  it('is upcoming before the start, open inside (ends inclusive), passed after the end', () => {
    expect(windowStateAt(lunch, '08:00')).toBe('UPCOMING');
    expect(windowStateAt(lunch, '11:59')).toBe('UPCOMING');
    expect(windowStateAt(lunch, '12:00')).toBe('OPEN');
    expect(windowStateAt(lunch, '15:30')).toBe('OPEN');
    expect(windowStateAt(lunch, '15:31')).toBe('PASSED');
  });

  it('keeps a stated single time open for an hour and a midnight-crossing window until the day ends', () => {
    const single = { start: '12:00', end: null, assumed: false };
    expect(windowStateAt(single, '12:30')).toBe('OPEN');
    expect(windowStateAt(single, '13:00')).toBe('OPEN');
    expect(windowStateAt(single, '13:01')).toBe('PASSED');
    const late = { start: '23:00', end: '01:00', assumed: false };
    expect(windowStateAt(late, '22:00')).toBe('UPCOMING');
    expect(windowStateAt(late, '23:45')).toBe('OPEN');
  });

  it('windowOf reads the window off a slot and is null for a row without one', () => {
    expect(windowOf(src('x', 'Meal', 0))).toBeNull();
    expect(
      windowOf(src('x', 'Meal', 0, { timeStart: '09:00', timeEnd: '10:00', timeAssumed: true })),
    ).toEqual({ start: '09:00', end: '10:00', assumed: true });
  });
});
