import { describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { PRUNE_RETENTION, runPrune } from '@/services/jobs/prune.job';

resetPrismaMock();

const now = new Date('2026-09-17T03:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe('runPrune', () => {
  it('deletes AiCall and AnalyticsEvent older than 90 days and FoodDataCache older than 30', async () => {
    prismaMock.aiCall.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.analyticsEvent.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.foodDataCache.deleteMany.mockResolvedValue({ count: 1 });

    await runPrune({ now, shouldStop: () => false });

    expect(PRUNE_RETENTION).toEqual({
      aiCallDays: 90,
      analyticsEventDays: 90,
      foodDataCacheDays: 30,
    });
    expect(prismaMock.aiCall.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysAgo(90) } },
    });
    expect(prismaMock.analyticsEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysAgo(90) } },
    });
    expect(prismaMock.foodDataCache.deleteMany).toHaveBeenCalledWith({
      where: { fetchedAt: { lt: daysAgo(30) } },
    });
  });

  it('stops at the checkpoint when the lease is lost', async () => {
    prismaMock.aiCall.deleteMany.mockResolvedValue({ count: 0 });
    let calls = 0;
    await runPrune({ now, shouldStop: () => ++calls >= 1 });
    expect(prismaMock.aiCall.deleteMany).toHaveBeenCalledOnce();
    expect(prismaMock.analyticsEvent.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.foodDataCache.deleteMany).not.toHaveBeenCalled();
  });
});
