import { ServiceError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/t';
import { isFutureLocalDateTime } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { markStaleIfNeeded } from '@/services/reflection.service';

/**
 * Day module, write half (tech spec § 5 Day, product spec § 8 "Day
 * completeness"). A DayRecord is created lazily on the first meal, skip or
 * completeness change; viewing a day never creates one. A day that has not
 * started yet is refused like a future meal (`FUTURE_TIME`). The read model
 * lives in `day-view.service.ts`.
 */

/** Upsert the day row; unique on (userId, localDate). The zone is fixed at creation. */
export async function ensureDayRecord(
  ownerId: string,
  localDate: string,
): Promise<{ id: string; localDate: string; timeZone: string; logComplete: boolean }> {
  return prisma.dayRecord.upsert({
    where: { userId_localDate: { userId: ownerId, localDate } },
    create: { userId: ownerId, localDate, timeZone: APP_TIME_ZONE },
    update: {},
    select: { id: true, localDate: true, timeZone: true, logComplete: true },
  });
}

/** Refuses a date later than today in the app zone. */
function refuseFutureDate(localDate: string, now: Date): void {
  if (isFutureLocalDateTime(localDate, null, now, APP_TIME_ZONE)) {
    throw new ServiceError(t('day.errors.futureDate'), 'FUTURE_TIME');
  }
}

/**
 * Mark a prescribed slot skipped for a day, or clear the mark. Refused with
 * `SLOT_HAS_MEAL` while a meal on that day is linked to the slot (recorded wins).
 */
export async function markSlotSkipped(
  ownerId: string,
  localDate: string,
  planSlotId: string,
  skipped: boolean,
  now = new Date(),
): Promise<void> {
  refuseFutureDate(localDate, now);
  const slot = await prisma.planSlot.findFirst({
    where: { id: planSlotId, plan: { userId: ownerId } },
    select: { id: true },
  });
  if (!slot) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');

  if (skipped) {
    const linked = await prisma.meal.findFirst({
      where: { userId: ownerId, planSlotId, day: { localDate } },
      select: { id: true },
    });
    if (linked) throw new ServiceError(t('meal.errors.slotHasMeal'), 'SLOT_HAS_MEAL');
    const day = await ensureDayRecord(ownerId, localDate);
    await prisma.daySkippedSlot.createMany({
      data: [{ dayRecordId: day.id, planSlotId }],
      skipDuplicates: true,
    });
  } else {
    await prisma.daySkippedSlot.deleteMany({
      where: { planSlotId, day: { userId: ownerId, localDate } },
    });
  }
  await markStaleIfNeeded(ownerId, localDate);
}

/** "I've logged everything for this day". Never reset by meal saves. */
export async function setDayCompleteness(
  ownerId: string,
  localDate: string,
  complete: boolean,
  now = new Date(),
): Promise<void> {
  refuseFutureDate(localDate, now);
  await prisma.dayRecord.upsert({
    where: { userId_localDate: { userId: ownerId, localDate } },
    create: { userId: ownerId, localDate, timeZone: APP_TIME_ZONE, logComplete: complete },
    update: { logComplete: complete },
  });
  await markStaleIfNeeded(ownerId, localDate);
}
