import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { registerTask, type JobContext } from '@/services/jobs/registry';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Operational tables are kept for a bounded window (tech spec § 12 `pruneOperational`). */
export const PRUNE_RETENTION = {
  aiCallDays: 90,
  analyticsEventDays: 90,
  foodDataCacheDays: 30,
} as const;

export async function runPrune(ctx: JobContext): Promise<void> {
  const before = (days: number) => new Date(ctx.now.getTime() - days * DAY_MS);

  const aiCalls = await prisma.aiCall.deleteMany({
    where: { createdAt: { lt: before(PRUNE_RETENTION.aiCallDays) } },
  });
  if (ctx.shouldStop()) return;

  const analyticsEvents = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: before(PRUNE_RETENTION.analyticsEventDays) } },
  });
  if (ctx.shouldStop()) return;

  const foodDataCache = await prisma.foodDataCache.deleteMany({
    where: { fetchedAt: { lt: before(PRUNE_RETENTION.foodDataCacheDays) } },
  });

  logger.info(
    {
      task: 'prune',
      aiCalls: aiCalls.count,
      analyticsEvents: analyticsEvents.count,
      foodDataCache: foodDataCache.count,
    },
    'prune finished',
  );
}

registerTask({ name: 'prune', everyMs: DAY_MS, run: runPrune });
