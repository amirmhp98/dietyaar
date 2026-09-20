import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { localDateFor, addDays } from '../../src/lib/time/local-date';
import { APP_TIME_ZONE } from '../../src/lib/time/zone';

/**
 * Direct database helpers for the Today / History / reflection specs: insert a
 * day with meals and items for a user and local date without going through
 * the composer, set completeness. Days are counted in the app zone (decision
 * 022). Uses DATABASE_URL from .env — the same database the dev server uses.
 */
const prisma = new PrismaClient();

export interface SeedItem {
  originalName: string;
  englishLabel: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string;
  kcal?: number | null;
}

export interface SeedMeal {
  /** "HH:mm" or null for time unknown. */
  time?: string | null;
  planSlotId?: string | null;
  planOptionId?: string | null;
  items: SeedItem[];
}

async function userByName(username: string) {
  return prisma.user.findUniqueOrThrow({ where: { usernameLower: username.toLowerCase() } });
}

/** Today in the app zone, offset by `days` (negative = past). */
export function localDateOf(days = 0): string {
  return addDays(localDateFor(new Date(), APP_TIME_ZONE), days);
}

function nutrition(kcal: number | null | undefined) {
  if (kcal === null || kcal === undefined) return null;
  return {
    basis: 'PER_RECORDED_PORTION',
    basisQuantity: null,
    basisUnit: null,
    values: {
      ENERGY_KCAL: kcal,
      PROTEIN_G: 5,
      CARB_G: 20,
      FAT_G: 5,
      FIBER_G: null,
      SODIUM_MG: null,
    },
    source: 'AI_ESTIMATE',
    sourceRef: null,
    isEstimate: true,
    userOverride: false,
  };
}

/** Insert one meal (creating the DayRecord in the app zone when missing). Returns the meal id. */
export async function insertMeal(
  username: string,
  localDate: string,
  meal: SeedMeal,
): Promise<string> {
  const user = await userByName(username);
  const day = await prisma.dayRecord.upsert({
    where: { userId_localDate: { userId: user.id, localDate } },
    create: { userId: user.id, localDate, timeZone: APP_TIME_ZONE },
    update: {},
  });
  const created = await prisma.meal.create({
    data: {
      userId: user.id,
      dayRecordId: day.id,
      consumedLocalTime: meal.time ?? null,
      inputKind: 'MANUAL',
      clientRequestId: randomUUID(),
      planSlotId: meal.planSlotId ?? null,
      planOptionId: meal.planOptionId ?? null,
      linkConfirmedByUser: true,
      items: {
        create: meal.items.map((item, position) => ({
          position,
          originalName: item.originalName,
          englishLabel: item.englishLabel,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          quantityUnknown: item.quantity === null,
          category: (item.category ?? 'OTHER') as never,
          nutrition: nutrition(item.kcal ?? 100) ?? undefined,
        })),
      },
    },
  });
  return created.id;
}

/** Rename every item of a meal (a fact change that makes a reflection stale). */
export async function renameMealItems(mealId: string, originalName: string, englishLabel: string) {
  await prisma.foodItem.updateMany({ where: { mealId }, data: { originalName, englishLabel } });
  await prisma.meal.update({ where: { id: mealId }, data: { revision: { increment: 1 } } });
}

export async function setDayComplete(username: string, localDate: string, complete: boolean) {
  const user = await userByName(username);
  await prisma.dayRecord.upsert({
    where: { userId_localDate: { userId: user.id, localDate } },
    create: { userId: user.id, localDate, timeZone: APP_TIME_ZONE, logComplete: complete },
    update: { logComplete: complete },
  });
}

/** Mark slots skipped for a day directly (to build complete past days quickly). */
export async function skipSlots(username: string, localDate: string, planSlotIds: string[]) {
  const user = await userByName(username);
  const day = await prisma.dayRecord.upsert({
    where: { userId_localDate: { userId: user.id, localDate } },
    create: { userId: user.id, localDate, timeZone: APP_TIME_ZONE },
    update: {},
  });
  await prisma.daySkippedSlot.createMany({
    data: planSlotIds.map((planSlotId) => ({ dayRecordId: day.id, planSlotId })),
    skipDuplicates: true,
  });
}

/** Pretend the account is `days` old: History lists days from the account's first day only. */
export async function backdateAccount(username: string, days: number) {
  const user = await userByName(username);
  const createdAt = new Date(Date.now() - days * 86_400_000);
  await prisma.user.update({ where: { id: user.id }, data: { createdAt } });
  await prisma.profile.update({ where: { userId: user.id }, data: { createdAt } });
}

/** Forget the day's reflection so the next visit claims a fresh one for a changed data state. */
export async function deleteMorningMessages(username: string) {
  const user = await userByName(username);
  await prisma.morningMessage.deleteMany({ where: { userId: user.id } });
}

/** Provider calls admitted for the user (a static reflection admits none). */
export async function countAiCalls(username: string, kind: 'REFLECTION'): Promise<number> {
  const user = await userByName(username);
  return prisma.aiCall.count({ where: { userId: user.id, kind } });
}

export async function disconnectMealsDb() {
  await prisma.$disconnect();
}
