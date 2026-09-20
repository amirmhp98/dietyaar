import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Machine-readable export (product spec § 15, tech spec § 7 `/api/export`):
 * the JSON documents of the zip plus the list of retained photos the route
 * streams from storage. Nothing operational or secret leaves: no password
 * hash, no lowered username, no session, no AI-call or analytics rows, no
 * draft state.
 */

const num = (value: Prisma.Decimal | null | undefined): number | null =>
  value == null ? null : Number(value);

export interface ExportBundle {
  exportedAt: string;
  profile: Record<string, unknown>;
  plan: Record<string, unknown> | null;
  meals: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  /** Attached uploads; the route writes each as `photos/{uploadId}.jpg`. */
  photos: Array<{ uploadId: string; mealId: string | null; storageKey: string; bytes: number }>;
}

export async function buildExport(ownerId: string, now: Date): Promise<ExportBundle> {
  const [user, profile, plan, meals, messages, uploads] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { username: true, createdAt: true },
    }),
    prisma.profile.findUnique({ where: { userId: ownerId } }),
    prisma.plan.findUnique({
      where: { userId: ownerId },
      include: {
        slots: {
          orderBy: [{ weekday: 'asc' }, { position: 'asc' }],
          include: {
            options: {
              orderBy: { position: 'asc' },
              include: { items: { orderBy: { position: 'asc' } } },
            },
          },
        },
        targets: { orderBy: { scopeKey: 'asc' } },
        notes: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.meal.findMany({
      where: { userId: ownerId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        day: { select: { localDate: true, timeZone: true, logComplete: true } },
        items: { orderBy: { position: 'asc' } },
        uploads: {
          where: { status: 'ATTACHED' },
          orderBy: { position: 'asc' },
          select: { id: true },
        },
      },
    }),
    prisma.morningMessage.findMany({
      where: { userId: ownerId, status: 'READY' },
      orderBy: { localDate: 'asc' },
    }),
    prisma.upload.findMany({
      where: { userId: ownerId, status: 'ATTACHED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, mealId: true, storageKey: true, bytes: true },
    }),
  ]);

  return {
    exportedAt: now.toISOString(),
    profile: {
      username: user.username,
      accountCreatedAt: user.createdAt,
      ...(profile
        ? {
            ageYears: profile.ageYears,
            sex: profile.sex,
            heightCm: num(profile.heightCm),
            weightKg: num(profile.weightKg),
            weightMeasuredAt: profile.weightMeasuredAt,
            unitSystem: profile.unitSystem,
            weekStart: profile.weekStart,
            displayName: profile.displayName,
            goal: profile.goal,
            restrictions: profile.restrictionsOriginal,
            completedAt: profile.completedAt,
          }
        : {}),
    },
    plan:
      plan && plan.status === 'ACTIVE'
        ? {
            status: plan.status,
            structure: plan.structure,
            name: plan.name,
            sourceNote: plan.sourceNote,
            sourceLanguage: plan.sourceLanguage,
            sourceText: plan.sourceText,
            confirmedAt: plan.confirmedAt,
            slots: plan.slots.map((slot) => ({
              id: slot.id,
              weekday: slot.weekday,
              position: slot.position,
              originalName: slot.originalName,
              englishLabel: slot.englishLabel,
              timeStart: slot.timeStart,
              timeEnd: slot.timeEnd,
              timeAssumed: slot.timeAssumed,
              sourceExcerpt: slot.sourceExcerpt,
              options: slot.options.map((option) => ({
                id: option.id,
                position: option.position,
                label: option.label,
                items: option.items.map((item) => ({
                  id: item.id,
                  position: item.position,
                  originalName: item.originalName,
                  englishLabel: item.englishLabel,
                  quantity: num(item.quantity),
                  unit: item.unit,
                  unitGrams: num(item.unitGrams),
                  quantityAssumed: item.quantityAssumed,
                  preparationNote: item.preparationNote,
                  alternatives: item.alternatives,
                  category: item.category,
                  nutrition: item.nutrition,
                  sourceExcerpt: item.sourceExcerpt,
                })),
              })),
            })),
            targets: plan.targets.map((target) => ({
              id: target.id,
              planSlotId: target.planSlotId,
              weekday: target.weekday,
              nutrient: target.nutrient,
              type: target.type,
              low: num(target.low),
              high: num(target.high),
              source: target.source,
              sourceExcerpt: target.sourceExcerpt,
            })),
            notes: plan.notes.map((note) => ({
              id: note.id,
              originalText: note.originalText,
              reason: note.reason,
            })),
          }
        : null,
    meals: meals.map((meal) => ({
      id: meal.id,
      date: meal.day.localDate,
      timeZone: meal.day.timeZone,
      dayLogComplete: meal.day.logComplete,
      time: meal.consumedLocalTime,
      inputKind: meal.inputKind,
      originalText: meal.originalText,
      notes: meal.notes,
      planSlotId: meal.planSlotId,
      planOptionId: meal.planOptionId,
      linkConfirmedByUser: meal.linkConfirmedByUser,
      copiedFromMealId: meal.copiedFromMealId,
      createdAt: meal.createdAt,
      updatedAt: meal.updatedAt,
      photos: meal.uploads.map((upload) => `photos/${upload.id}.jpg`),
      items: meal.items.map((item) => ({
        id: item.id,
        position: item.position,
        originalName: item.originalName,
        englishLabel: item.englishLabel,
        quantity: num(item.quantity),
        unit: item.unit,
        unitGrams: num(item.unitGrams),
        quantityUnknown: item.quantityUnknown,
        quantityAssumed: item.quantityAssumed,
        preparation: item.preparation,
        category: item.category,
        alternatives: item.alternatives,
        matchedPlanItemId: item.matchedPlanItemId,
        isAddedItem: item.isAddedItem,
        restrictionHit: item.restrictionHit,
        nutrition: item.nutrition,
      })),
    })),
    messages: messages.map((message) => ({
      date: message.localDate,
      paragraph: message.paragraph,
      isFallback: message.isFallback,
      generatedAt: message.generatedAt,
    })),
    photos: uploads.map((upload) => ({
      uploadId: upload.id,
      mealId: upload.mealId,
      storageKey: upload.storageKey,
      bytes: upload.bytes,
    })),
  };
}
