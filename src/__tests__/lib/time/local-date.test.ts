import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  dayBounds,
  daysBetween,
  instantFor,
  isFutureLocalDateTime,
  isLateNightWindow,
  isValidLocalDate,
  isValidLocalTime,
  isValidTimeZone,
  localDateFor,
  localTimeFor,
  weekBounds,
  weekdayOf,
} from '@/lib/time';

describe('localDateFor / localTimeFor', () => {
  it('uses the zone, not UTC (Tehran is UTC+3:30, no DST since 2022)', () => {
    const instant = new Date('2026-09-16T21:00:00Z');
    expect(localDateFor(instant, 'Asia/Tehran')).toBe('2026-09-17');
    expect(localTimeFor(instant, 'Asia/Tehran')).toBe('00:30');
    expect(localDateFor(instant, 'UTC')).toBe('2026-09-16');
  });

  it('handles the midnight edge (TS-§21.5)', () => {
    expect(localDateFor(new Date('2026-09-16T20:29:59Z'), 'Asia/Tehran')).toBe('2026-09-16');
    expect(localDateFor(new Date('2026-09-16T20:30:00Z'), 'Asia/Tehran')).toBe('2026-09-17');
  });

  it('follows DST in Europe/Berlin', () => {
    // 2026-03-29 02:00 CET → 03:00 CEST
    expect(localTimeFor(new Date('2026-03-29T00:59:00Z'), 'Europe/Berlin')).toBe('01:59');
    expect(localTimeFor(new Date('2026-03-29T01:00:00Z'), 'Europe/Berlin')).toBe('03:00');
  });
});

describe('dayBounds', () => {
  it('spans exactly the local day in Tehran', () => {
    const { start, end } = dayBounds('2026-09-17', 'Asia/Tehran');
    expect(start.toISOString()).toBe('2026-09-16T20:30:00.000Z');
    expect(end.toISOString()).toBe('2026-09-17T20:30:00.000Z');
  });

  it('is 23 hours on the spring-forward day in Berlin', () => {
    const { start, end } = dayBounds('2026-03-29', 'Europe/Berlin');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('is 25 hours on the fall-back day in Berlin', () => {
    const { start, end } = dayBounds('2026-10-25', 'Europe/Berlin');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe('isLateNightWindow', () => {
  it('is true from 00:00 to 03:59 and false at 04:00 (TS-§21.6)', () => {
    expect(isLateNightWindow(instantFor('2026-09-17', '00:00', 'Asia/Tehran'), 'Asia/Tehran')).toBe(
      true,
    );
    expect(isLateNightWindow(instantFor('2026-09-17', '03:59', 'Asia/Tehran'), 'Asia/Tehran')).toBe(
      true,
    );
    expect(isLateNightWindow(instantFor('2026-09-17', '04:00', 'Asia/Tehran'), 'Asia/Tehran')).toBe(
      false,
    );
    expect(isLateNightWindow(instantFor('2026-09-17', '23:59', 'Asia/Tehran'), 'Asia/Tehran')).toBe(
      false,
    );
  });
});

describe('calendar arithmetic', () => {
  it('weekdayOf, addDays, daysBetween, dateRange', () => {
    expect(weekdayOf('2026-09-17')).toBe(4); // Thursday
    expect(weekdayOf('2026-09-19')).toBe(6); // Saturday
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-10', '2026-09-17')).toBe(7);
    expect(dateRange('2026-09-15', '2026-09-17')).toEqual([
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
  });

  it('weekBounds anchors on the week start (Saturday = 6)', () => {
    expect(weekBounds('2026-09-17', 6)).toEqual({ start: '2026-09-12', end: '2026-09-18' });
    expect(weekBounds('2026-09-19', 6)).toEqual({ start: '2026-09-19', end: '2026-09-25' });
    expect(weekBounds('2026-09-17', 1)).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });

  it('validates dates, times and zones', () => {
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-9-1')).toBe(false);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidTimeZone('Asia/Tehran')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('isFutureLocalDateTime', () => {
  const now = new Date('2026-09-17T10:00:00Z'); // 13:30 Tehran
  it('rejects a later date even with unknown time, allows past dates', () => {
    expect(isFutureLocalDateTime('2026-09-18', null, now, 'Asia/Tehran')).toBe(true);
    expect(isFutureLocalDateTime('2026-09-16', '23:00', now, 'Asia/Tehran')).toBe(false);
  });
  it('compares the clock on today', () => {
    expect(isFutureLocalDateTime('2026-09-17', '13:30', now, 'Asia/Tehran')).toBe(false);
    expect(isFutureLocalDateTime('2026-09-17', '13:31', now, 'Asia/Tehran')).toBe(true);
    expect(isFutureLocalDateTime('2026-09-17', null, now, 'Asia/Tehran')).toBe(false);
  });
});
