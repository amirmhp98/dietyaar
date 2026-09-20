import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { dayRecordFactory, mealFactory } from '@/__tests__/factories';

vi.mock('@/services/reflection.service', () => ({ markStaleIfNeeded: vi.fn() }));

import { markStaleIfNeeded } from '@/services/reflection.service';
import { markSlotSkipped, setDayCompleteness } from '@/services/day.service';

resetPrismaMock();

const OWNER = 'user-1';
/** 2026-09-17 23:00 in Asia/Dubai (19:00Z): the 18th has not started there yet. */
const NOW = new Date('2026-09-17T19:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.planSlot.findFirst.mockResolvedValue({ id: 'slot-1' } as never);
});

describe('markSlotSkipped', () => {
  it('refuses SLOT_HAS_MEAL while a meal on that day is linked to the slot', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(mealFactory.build({ planSlotId: 'slot-1' }));
    await expect(markSlotSkipped(OWNER, '2026-09-17', 'slot-1', true)).rejects.toMatchObject({
      code: 'SLOT_HAS_MEAL',
    });
    expect(prismaMock.daySkippedSlot.createMany).not.toHaveBeenCalled();
    expect(markStaleIfNeeded).not.toHaveBeenCalled();
  });

  it('creates the day lazily in the app zone, records the skip once, and marks staleness', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.dayRecord.upsert.mockResolvedValue(dayRecordFactory.build({ id: 'day-9' }));
    prismaMock.daySkippedSlot.createMany.mockResolvedValue({ count: 1 });
    await markSlotSkipped(OWNER, '2026-09-17', 'slot-1', true);
    expect(prismaMock.dayRecord.upsert.mock.calls[0]?.[0].create).toMatchObject({
      userId: OWNER,
      localDate: '2026-09-17',
      timeZone: 'Asia/Dubai',
    });
    expect(prismaMock.daySkippedSlot.createMany).toHaveBeenCalledWith({
      data: [{ dayRecordId: 'day-9', planSlotId: 'slot-1' }],
      skipDuplicates: true,
    });
    expect(markStaleIfNeeded).toHaveBeenCalledWith(OWNER, '2026-09-17');
  });

  it('clears the mark without touching meals', async () => {
    prismaMock.daySkippedSlot.deleteMany.mockResolvedValue({ count: 1 });
    await markSlotSkipped(OWNER, '2026-09-17', 'slot-1', false);
    expect(prismaMock.meal.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.daySkippedSlot.deleteMany).toHaveBeenCalledWith({
      where: { planSlotId: 'slot-1', day: { userId: OWNER, localDate: '2026-09-17' } },
    });
  });

  it("refuses a slot that is not in the user's plan", async () => {
    prismaMock.planSlot.findFirst.mockResolvedValue(null);
    await expect(markSlotSkipped(OWNER, '2026-09-17', 'other', true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses a day that has not started in the app zone, like meals do', async () => {
    await expect(markSlotSkipped(OWNER, '2026-09-18', 'slot-1', true, NOW)).rejects.toMatchObject({
      code: 'FUTURE_TIME',
    });
    await expect(markSlotSkipped(OWNER, '2026-09-18', 'slot-1', false, NOW)).rejects.toMatchObject({
      code: 'FUTURE_TIME',
    });
    expect(prismaMock.planSlot.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.daySkippedSlot.deleteMany).not.toHaveBeenCalled();

    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.dayRecord.upsert.mockResolvedValue(dayRecordFactory.build({ id: 'day-9' }));
    prismaMock.daySkippedSlot.createMany.mockResolvedValue({ count: 1 });
    await expect(
      markSlotSkipped(OWNER, '2026-09-17', 'slot-1', true, NOW),
    ).resolves.toBeUndefined();
  });
});

describe('setDayCompleteness', () => {
  it('upserts the flag and marks staleness', async () => {
    prismaMock.dayRecord.upsert.mockResolvedValue(dayRecordFactory.build({ logComplete: false }));
    await setDayCompleteness(OWNER, '2026-09-16', false);
    expect(prismaMock.dayRecord.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { userId_localDate: { userId: OWNER, localDate: '2026-09-16' } },
      create: { logComplete: false, timeZone: 'Asia/Dubai' },
      update: { logComplete: false },
    });
    expect(markStaleIfNeeded).toHaveBeenCalledWith(OWNER, '2026-09-16');
  });

  it('refuses a future day', async () => {
    await expect(setDayCompleteness(OWNER, '2026-09-18', false, NOW)).rejects.toMatchObject({
      code: 'FUTURE_TIME',
    });
    expect(prismaMock.dayRecord.upsert).not.toHaveBeenCalled();
    expect(markStaleIfNeeded).not.toHaveBeenCalled();
  });
});
