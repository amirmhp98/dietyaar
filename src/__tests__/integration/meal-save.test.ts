import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { draftFoodItemSchema } from '@/lib/validations/meal';
import type { MealAnalysisOutput } from '@/services/ai/schemas';
import type { AiResult } from '@/services/ai/types';
import { createTestUser, resetDatabase } from '@/__tests__/integration/db';

// The AI adapter and the usage counter are the only doubles: everything else hits Postgres.
vi.mock('@/services/ai/analyze-meal', () => ({ analyzeMeal: vi.fn() }));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call' })),
  finishOperation: vi.fn(),
}));

import { analyzeMeal } from '@/services/ai/analyze-meal';
import {
  analyzeDraft,
  createDraft,
  expireDrafts,
  resetRecentMealsCache,
  saveMeal,
  updateDraft,
  updateMeal,
} from '@/services/meal.service';
import { markSlotSkipped } from '@/services/day.service';

/** 09:30 in Tehran on 2026-09-17. */
const NOW = new Date('2026-09-17T06:00:00Z');
const REQ = '22222222-2222-4222-8222-222222222222';

async function createPlan(userId: string) {
  return prisma.plan.create({
    data: {
      userId,
      status: 'ACTIVE',
      structure: 'SAME_EVERY_DAY',
      confirmedAt: NOW,
      slots: {
        create: [
          {
            weekday: 7,
            position: 0,
            originalName: 'Breakfast',
            englishLabel: 'Breakfast',
            options: {
              create: [
                {
                  position: 0,
                  items: {
                    create: [
                      {
                        position: 0,
                        originalName: 'egg',
                        englishLabel: 'egg',
                        quantity: 2,
                        unit: 'piece',
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            weekday: 7,
            position: 1,
            originalName: 'Lunch',
            englishLabel: 'Lunch',
            options: {
              create: [
                {
                  position: 0,
                  label: 'A',
                  items: {
                    create: [
                      {
                        position: 0,
                        originalName: 'rice',
                        englishLabel: 'rice',
                        quantity: 150,
                        unit: 'g',
                      },
                    ],
                  },
                },
                {
                  position: 1,
                  label: 'B',
                  items: {
                    create: [
                      {
                        position: 0,
                        originalName: 'bread',
                        englishLabel: 'bread',
                        quantity: 80,
                        unit: 'g',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: { slots: { include: { options: true }, orderBy: { position: 'asc' } } },
  });
}

function textDraftInput(clientRequestId: string, overrides = {}) {
  return {
    clientRequestId,
    kind: 'TEXT' as const,
    text: 'two eggs',
    uploadIds: [],
    localDate: '2026-09-17',
    time: '08:30',
    planSlotId: null,
    planOptionId: null,
    copiedFromMealId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDatabase();
  resetRecentMealsCache();
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('saveMeal (tech spec § 21.9)', () => {
  it('two concurrent saves with one clientRequestId produce one meal and both return it', async () => {
    const user = await createTestUser();
    const { draft } = await createDraft(user.id, textDraftInput(REQ), NOW);
    if (!draft) throw new Error('expected a draft');

    const [a, b] = await Promise.all([
      saveMeal(user.id, draft.id, draft.revision, REQ, NOW),
      saveMeal(user.id, draft.id, draft.revision, REQ, NOW),
    ]);

    expect(a.id).toBe(b.id);
    expect(await prisma.meal.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.mealDraft.count({ where: { userId: user.id } })).toBe(0);
    // The retry whose first response was lost still finds the meal after the draft is gone.
    const retry = await saveMeal(user.id, draft.id, draft.revision, REQ, NOW);
    expect(retry.id).toBe(a.id);
  });

  it('a stale revision is refused with CONFLICT and the current revision', async () => {
    const user = await createTestUser();
    const { draft } = await createDraft(user.id, textDraftInput(REQ), NOW);
    if (!draft) throw new Error('expected a draft');
    await updateDraft(user.id, draft.id, draft.revision, { notes: 'late' }, NOW);
    await expect(saveMeal(user.id, draft.id, draft.revision, REQ, NOW)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { currentRevision: draft.revision + 1 },
    });
  });

  it('saving into a slot the day had marked skipped unskips it; the option is required first', async () => {
    const user = await createTestUser();
    const plan = await createPlan(user.id);
    const lunch = plan.slots[1]!;
    await markSlotSkipped(user.id, '2026-09-17', lunch.id, true);
    expect(await prisma.daySkippedSlot.count()).toBe(1);

    const { draft } = await createDraft(
      user.id,
      textDraftInput(REQ, { kind: 'PLANNED', text: null, planSlotId: lunch.id }),
      NOW,
    );
    if (!draft) throw new Error('expected a draft');
    await expect(saveMeal(user.id, draft.id, draft.revision, REQ, NOW)).rejects.toMatchObject({
      code: 'OPTION_REQUIRED',
    });

    const optionA = lunch.options.find((o) => o.label === 'A')!;
    const updated = await updateDraft(
      user.id,
      draft.id,
      draft.revision,
      { planOptionId: optionA.id },
      NOW,
    );
    const meal = await saveMeal(user.id, draft.id, updated.draft.revision, REQ, NOW);
    expect(meal.planSlotId).toBe(lunch.id);
    expect(meal.planOptionId).toBe(optionA.id);
    expect(await prisma.daySkippedSlot.count()).toBe(0);
    await expect(markSlotSkipped(user.id, '2026-09-17', lunch.id, true)).rejects.toMatchObject({
      code: 'SLOT_HAS_MEAL',
    });
  });

  it('a stale updateMeal from another device returns CONFLICT (tech spec § 21.10)', async () => {
    const user = await createTestUser();
    const { draft } = await createDraft(user.id, textDraftInput(REQ), NOW);
    if (!draft) throw new Error('expected a draft');
    const meal = await saveMeal(user.id, draft.id, draft.revision, REQ, NOW);
    const first = await updateMeal(user.id, meal.id, meal.revision, { notes: 'device A' }, NOW);
    expect(first.revision).toBe(meal.revision + 1);
    await expect(
      updateMeal(user.id, meal.id, meal.revision, { notes: 'device B' }, NOW),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: { currentRevision: first.revision } });
    expect((await prisma.meal.findUniqueOrThrow({ where: { id: meal.id } })).notes).toBe(
      'device A',
    );
  });
});

describe('analyzeDraft (tech spec § 21.8)', () => {
  it('a late AI result cannot overwrite the edit made while it ran', async () => {
    const user = await createTestUser();
    const { draft } = await createDraft(user.id, textDraftInput(REQ), NOW);
    if (!draft) throw new Error('expected a draft');

    let release!: (value: AiResult<MealAnalysisOutput>) => void;
    vi.mocked(analyzeMeal).mockReturnValue(
      new Promise<AiResult<MealAnalysisOutput>>((resolve) => {
        release = resolve;
      }),
    );

    const running = analyzeDraft(user.id, draft.id, draft.revision, NOW);
    // Wait for the run to be marked RUNNING, then edit the quantity: the revision advances.
    await vi.waitFor(async () => {
      const row = await prisma.mealDraft.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.analysisStatus).toBe('RUNNING');
    });
    const edited = await updateDraft(
      user.id,
      draft.id,
      draft.revision,
      {
        items: [
          draftFoodItemSchema.parse({
            key: 'a',
            originalName: 'egg',
            englishLabel: 'egg',
            quantity: 3,
            unit: 'piece',
          }),
        ],
      },
      NOW,
    );

    release({
      ok: true,
      data: {
        items: [
          {
            originalName: 'egg',
            englishLabel: 'egg',
            quantity: 1,
            unit: 'piece',
            quantityUnknown: false,
            quantityAssumed: false,
            preparation: null,
            category: 'OTHER',
            alternatives: [],
            nutrition: null,
          },
        ],
        suggestedSlot: null,
        suggestedOptionIndex: null,
        questions: [],
      },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'stub',
      durationMs: 1,
    });
    const after = await running;

    expect(after.revision).toBe(edited.draft.revision);
    expect(after.analysisStatus).toBe('FAILED');
    expect(after.analysisFailureReason).toBe('SUPERSEDED');
    expect(after.state.items[0]?.quantity).toBe(3);
  });
});

describe('expireDrafts (tech spec § 21.18)', () => {
  it('removes a draft last edited 25 hours ago and keeps one edited 23 hours ago', async () => {
    const user = await createTestUser();
    const old = await createDraft(
      user.id,
      textDraftInput(REQ),
      new Date(NOW.getTime() - 25 * 3600 * 1000),
    );
    const fresh = await createDraft(
      user.id,
      textDraftInput('33333333-3333-4333-8333-333333333333', { uploadIds: ['up-fresh'] }),
      new Date(NOW.getTime() - 23 * 3600 * 1000),
    );
    const result = await expireDrafts(NOW);
    expect(result.deleted).toBe(1);
    expect(result.uploadIds).toEqual([]);
    expect(await prisma.mealDraft.findUnique({ where: { id: old.draft!.id } })).toBeNull();
    expect(await prisma.mealDraft.findUnique({ where: { id: fresh.draft!.id } })).not.toBeNull();
  });
});
