import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import {
  dayRecordFactory,
  draftItem,
  draftState,
  eggNutrition,
  foodItemFactory,
  mealDraftFactory,
  mealFactory,
  profileFactory,
  uploadFactory,
} from '@/__tests__/factories';
import type { RubricSlot } from '@/lib/rubric/types';
import { ServiceError } from '@/lib/errors';
import type { MealDraftState } from '@/lib/validations/meal';

vi.mock('@/services/profile.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/profile.service')>()),
  getProfile: vi.fn(),
}));
vi.mock('@/services/plan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/plan.service')>()),
  getActivePlan: vi.fn(),
}));
vi.mock('@/services/ai/analyze-meal', () => ({ analyzeMeal: vi.fn() }));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(),
  finishOperation: vi.fn(),
}));
vi.mock('@/services/reflection.service', () => ({ markStaleIfNeeded: vi.fn() }));
vi.mock('@/services/upload.service', () => ({
  readStagedImages: vi.fn(async () => []),
  removeUpload: vi.fn(),
  deleteStagedUpload: vi.fn(),
}));
vi.mock('@/services/storage/s3', () => ({ deleteObjects: vi.fn(async () => undefined) }));

import { analyzeMeal } from '@/services/ai/analyze-meal';
import type { MealAnalysisOutput } from '@/services/ai/schemas';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import { getActivePlan } from '@/services/plan.service';
import { getProfile, toProfileView } from '@/services/profile.service';
import { markStaleIfNeeded } from '@/services/reflection.service';
import { deleteObjects } from '@/services/storage/s3';
import { deleteStagedUpload } from '@/services/upload.service';
import {
  analyzeDraft,
  createDraft,
  deleteMeal,
  discardDraft,
  mergeRefinedItems,
  reconcileItem,
  resetRecentMealsCache,
  saveMeal,
  setMealLink,
  updateDraft,
} from '@/services/meal.service';

resetPrismaMock();

const OWNER = 'user-1';
/** 10:00 in Asia/Dubai on 2026-09-17 (a Thursday). */
const NOW = new Date('2026-09-17T06:00:00Z');
const REQ = '11111111-1111-4111-8111-111111111111';

const planItem = (id: string, name: string, quantity: number | null, extra = {}) => ({
  id,
  originalName: name,
  englishLabel: name,
  quantity,
  unit: quantity === null ? null : 'g',
  quantityAssumed: false,
  category: 'OTHER' as const,
  alternatives: [],
  nutrition: eggNutrition,
  ...extra,
});

const lunch: RubricSlot = {
  id: 'slot-lunch',
  weekday: 7,
  position: 1,
  originalName: 'ناهار',
  englishLabel: 'Lunch',
  timeStart: null,
  timeEnd: null,
  options: [
    { id: 'opt-a', position: 0, label: 'A', items: [planItem('pi-rice', 'rice', 150)] },
    { id: 'opt-b', position: 1, label: 'B', items: [planItem('pi-bread', 'bread', 80)] },
  ],
};

const breakfast: RubricSlot = {
  id: 'slot-breakfast',
  weekday: 7,
  position: 0,
  originalName: 'صبحانه',
  englishLabel: 'Breakfast',
  timeStart: '08:00',
  timeEnd: '09:00',
  options: [
    {
      id: 'opt-bf',
      position: 0,
      label: null,
      items: [
        planItem('pi-egg', 'egg', 2, { unit: 'piece' }),
        planItem('pi-oil', 'oil', 1, { unit: 'tsp', quantityAssumed: true, category: 'OIL' }),
      ],
    },
  ],
};

function plan(slots: RubricSlot[]) {
  return {
    id: 'plan-1',
    status: 'ACTIVE' as const,
    structure: 'SAME_EVERY_DAY' as const,
    name: null,
    sourceNote: null,
    confirmedAt: NOW,
    createdAt: NOW,
    slots,
    targets: [],
    rules: [],
    notes: [],
    draft: null,
  };
}

function useTransaction() {
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    (fn as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRecentMealsCache();
  vi.mocked(getProfile).mockResolvedValue(
    toProfileView(
      profileFactory.build({
        userId: OWNER,
        restrictionsOriginal: ['Walnuts'],
        restrictions: ['walnuts'],
      }),
    ),
  );
  vi.mocked(getActivePlan).mockResolvedValue(plan([breakfast, lunch]));
});

describe('createDraft', () => {
  it('is idempotent on clientRequestId: returns the existing draft without creating another', async () => {
    const existing = mealDraftFactory.build({ userId: OWNER, clientRequestId: REQ });
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.findFirst.mockResolvedValue(existing);
    const result = await createDraft(
      OWNER,
      {
        clientRequestId: REQ,
        kind: 'TEXT',
        text: 'x',
        uploadIds: [],
        localDate: '2026-09-17',
        time: null,
        planSlotId: null,
        planOptionId: null,
        copiedFromMealId: null,
      },
      NOW,
    );
    expect(result.draft?.id).toBe(existing.id);
    expect(prismaMock.mealDraft.create).not.toHaveBeenCalled();
  });

  it('returns the saved meal when the request was already confirmed (TS-§21.9)', async () => {
    prismaMock.meal.findFirst.mockResolvedValue({
      ...mealFactory.build({ userId: OWNER, clientRequestId: REQ }),
      items: [],
      uploads: [],
      day: dayRecordFactory.build(),
      planSlot: null,
      planOption: null,
    } as never);
    const result = await createDraft(
      OWNER,
      {
        clientRequestId: REQ,
        kind: 'TEXT',
        text: 'x',
        uploadIds: [],
        localDate: '2026-09-17',
        time: null,
        planSlotId: null,
        planOptionId: null,
        copiedFromMealId: null,
      },
      NOW,
    );
    expect(result.meal?.clientRequestId).toBe(REQ);
    expect(result.draft).toBeNull();
    expect(prismaMock.mealDraft.findFirst).not.toHaveBeenCalled();
  });

  it('prefills a PLANNED draft from the chosen option with prescribed portions and nutrition', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.create.mockImplementation((async ({
      data,
    }: {
      data: { state: MealDraftState };
    }) =>
      mealDraftFactory.build({ userId: OWNER, clientRequestId: REQ, state: data.state })) as never);
    const result = await createDraft(
      OWNER,
      {
        clientRequestId: REQ,
        kind: 'PLANNED',
        text: null,
        uploadIds: [],
        localDate: '2026-09-17',
        time: '08:30',
        planSlotId: 'slot-breakfast',
        planOptionId: null,
        copiedFromMealId: null,
      },
      NOW,
    );
    const state = result.draft!.state;
    expect(state.planSlotId).toBe('slot-breakfast');
    expect(state.planOptionId).toBe('opt-bf');
    expect(state.items).toHaveLength(2);
    expect(state.items[0]).toMatchObject({
      englishLabel: 'egg',
      quantity: 2,
      unit: 'piece',
      matchedPlanItemId: 'pi-egg',
      nutrition: eggNutrition,
    });
    expect(state.items[1]).toMatchObject({
      englishLabel: 'oil',
      quantityAssumed: true,
      matchedPlanItemId: 'pi-oil',
    });
    const created = prismaMock.mealDraft.create.mock.calls[0]?.[0].data;
    expect(created?.expiresAt).toEqual(new Date(NOW.getTime() + 24 * 3600 * 1000));
    expect(created?.analysisInputHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('reconcileItem (tech spec § 5.1)', () => {
  it('rescales an AI estimate linearly on a quantity edit', () => {
    const prev = draftItem({ key: 'a', quantity: 2 });
    const next = reconcileItem(draftItem({ key: 'a', quantity: 3 }), prev);
    expect(next.scaleFlag).toBe('SCALED');
    expect(next.nutrition?.values.ENERGY_KCAL).toBe(210);
    expect(next.nutrition?.values.PROTEIN_G).toBe(18);
    expect(next.nutrition?.values.FIBER_G).toBeNull();
  });

  it('never scales a user override; the row says "Check this value"', () => {
    const override = { ...eggNutrition, source: 'USER_LABEL' as const, userOverride: true };
    const prev = draftItem({ key: 'a', quantity: 2, nutrition: override });
    const next = reconcileItem(draftItem({ key: 'a', quantity: 5, nutrition: override }), prev);
    expect(next.scaleFlag).toBe('CHECK_VALUE');
    expect(next.nutrition?.values.ENERGY_KCAL).toBe(140);
  });

  it('marks an identity change for re-estimation and keeps the previous values struck through', () => {
    const prev = draftItem({ key: 'a' });
    const next = reconcileItem(
      draftItem({ key: 'a', originalName: 'omelette', englishLabel: 'omelette' }),
      prev,
    );
    expect(next.needsReestimate).toBe(true);
    expect(next.nutrition).toBeNull();
    expect(next.previousNutrition).toEqual(eggNutrition);
  });

  it('an edited original name is a new identity even when the English label still matches', () => {
    const prev = draftItem({ key: 'a', originalName: 'تخم‌مرغ', englishLabel: 'Egg' });
    const next = reconcileItem(
      draftItem({ key: 'a', originalName: 'املت', englishLabel: 'Egg' }),
      prev,
    );
    expect(next.needsReestimate).toBe(true);
    expect(next.nutrition).toBeNull();
  });

  it('a spelling-only change of the same name is not an identity change', () => {
    const prev = draftItem({ key: 'a', originalName: 'تخم مرغ', englishLabel: 'Egg' });
    const next = reconcileItem(
      draftItem({ key: 'a', originalName: 'تخم‌مرغ', englishLabel: 'Egg' }),
      prev,
    );
    expect(next.needsReestimate).toBe(false);
  });
});

describe('updateDraft', () => {
  it('refuses a stale revision with CONFLICT and the current revision', async () => {
    prismaMock.mealDraft.findFirst.mockResolvedValue(
      mealDraftFactory.build({ userId: OWNER, revision: 3 }),
    );
    await expect(updateDraft(OWNER, 'draft-1', 2, { notes: 'x' }, NOW)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { currentRevision: 3 },
    });
    expect(prismaMock.mealDraft.updateMany).not.toHaveBeenCalled();
  });

  it('rescales an edited quantity, bumps the revision and refreshes the reminders and hash', async () => {
    const row = mealDraftFactory.build({ userId: OWNER, revision: 1, analysisInputHash: 'old' });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    await updateDraft(
      OWNER,
      row.id,
      1,
      {
        text: 'three eggs and walnuts',
        items: [
          draftItem({ key: 'a', quantity: 3 }),
          draftItem({ key: 'b', originalName: 'گردو', englishLabel: 'walnuts', nutrition: null }),
        ],
      },
      NOW,
    );
    const call = prismaMock.mealDraft.updateMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ id: row.id, userId: OWNER, revision: 1 });
    const data = call?.data as {
      state: MealDraftState;
      revision: number;
      analysisInputHash: string;
    };
    expect(data.revision).toBe(2);
    expect(data.analysisInputHash).not.toBe('old');
    expect(data.state.items[0]?.nutrition?.values.ENERGY_KCAL).toBe(210);
    expect(data.state.items[0]?.scaleFlag).toBe('SCALED');
    expect(data.state.restrictionHits).toEqual([{ itemKey: 'b', restriction: 'Walnuts' }]);
  });

  it('returns the slot match preview when a slot and option are resolved', async () => {
    const row = mealDraftFactory.build({
      userId: OWNER,
      state: draftState({
        planSlotId: 'slot-lunch',
        planOptionId: 'opt-a',
        items: [
          draftItem({
            key: 'a',
            originalName: 'rice',
            englishLabel: 'rice',
            quantity: 150,
            unit: 'g',
          }),
        ],
      }),
    });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    const { preview } = await updateDraft(OWNER, row.id, 1, { notes: 'n' }, NOW);
    expect(preview.match?.status).toBe('MATCHED');
    const data = prismaMock.mealDraft.updateMany.mock.calls[0]?.[0].data as {
      state: MealDraftState;
    };
    expect(data.state.items[0]?.matchedPlanItemId).toBe('pi-rice');
  });
});

describe('analyzeDraft', () => {
  const output = {
    items: [
      {
        originalName: 'rice',
        englishLabel: 'rice',
        quantity: 150,
        unit: 'g',
        quantityUnknown: false,
        quantityAssumed: false,
        preparation: null,
        category: 'RICE' as const,
        alternatives: [],
        nutrition: eggNutrition,
      },
    ],
    suggestedSlot: { originalName: 'Lunch', englishLabel: 'Lunch' },
    suggestedOptionIndex: null,
    questions: [{ itemIndex: 0, question: 'How much?', kind: 'PORTION' as const, choices: [] }],
    changes: [],
  };

  beforeEach(() => {
    vi.mocked(admitOperation).mockResolvedValue({ ok: true, callId: 'call-1' });
    vi.mocked(analyzeMeal).mockResolvedValue({
      ok: true,
      data: output,
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 5,
    });
  });

  it('persists the result conditionally, maps the suggested slot and option, and bumps the revision', async () => {
    const row = mealDraftFactory.build({ userId: OWNER, revision: 2 });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    await analyzeDraft(OWNER, row.id, 2, NOW);
    const calls = prismaMock.mealDraft.updateMany.mock.calls;
    expect(calls[0]?.[0].data).toMatchObject({
      analysisStatus: 'RUNNING',
      analysisStartedRevision: 2,
    });
    const runId = (calls[0]?.[0].data as { analysisRunId: string }).analysisRunId;
    expect(calls[1]?.[0].where).toEqual({ id: row.id, analysisRunId: runId, revision: 2 });
    const data = calls[1]?.[0].data as {
      state: MealDraftState;
      revision: number;
      analysisStatus: string;
    };
    expect(data.revision).toBe(3);
    expect(data.analysisStatus).toBe('DONE');
    expect(data.state.planSlotId).toBe('slot-lunch');
    expect(data.state.planOptionId).toBe('opt-a');
    expect(data.state.items[0]?.matchedPlanItemId).toBe('pi-rice');
    expect(data.state.questions[0]?.itemKey).toBe(data.state.items[0]?.key);
    expect(vi.mocked(analyzeMeal).mock.calls[0]?.[0].deadlineAt).toBe(NOW.getTime() + 45_000);
    expect(finishOperation).toHaveBeenCalledWith(
      'call-1',
      expect.objectContaining({ ok: true }),
      2,
    );
  });

  it('drops a late result when the user edited meanwhile: FAILED / SUPERSEDED, values untouched (TS-§21.8)', async () => {
    const row = mealDraftFactory.build({ userId: OWNER, revision: 1 });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany
      .mockResolvedValueOnce({ count: 1 }) // RUNNING
      .mockResolvedValueOnce({ count: 0 }) // conditional persist: revision moved on
      .mockResolvedValueOnce({ count: 1 }); // SUPERSEDED
    await analyzeDraft(OWNER, row.id, 1, NOW);
    const calls = prismaMock.mealDraft.updateMany.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[2]?.[0].where).toMatchObject({ id: row.id, analysisStatus: 'RUNNING' });
    expect(calls[2]?.[0].data).toEqual({
      analysisStatus: 'FAILED',
      analysisFailureReason: 'SUPERSEDED',
    });
  });

  it('turns a timeout into AI_TIMEOUT and records the failure', async () => {
    vi.mocked(analyzeMeal).mockResolvedValue({
      ok: false,
      reason: 'TIMEOUT',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 45_000,
    });
    const row = mealDraftFactory.build({ userId: OWNER });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    await expect(analyzeDraft(OWNER, row.id, 1, NOW)).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
    expect(prismaMock.mealDraft.updateMany.mock.calls[1]?.[0].data).toEqual({
      analysisStatus: 'FAILED',
      analysisFailureReason: 'TIMEOUT',
    });
  });

  it('refuses at the daily cap without calling the adapter', async () => {
    vi.mocked(admitOperation).mockResolvedValue({ ok: false, code: 'DAILY_AI_CAP' });
    const row = mealDraftFactory.build({ userId: OWNER });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    await expect(analyzeDraft(OWNER, row.id, 1, NOW)).rejects.toMatchObject({
      code: 'DAILY_AI_CAP',
    });
    expect(analyzeMeal).not.toHaveBeenCalled();
  });
});

describe('analyzeDraft in REFINE mode (B1)', () => {
  const aiItem = (
    originalName: string,
    quantity: number | null,
    unit: string | null,
    kcal: number | null,
  ): MealAnalysisOutput['items'][number] => ({
    originalName,
    englishLabel: originalName,
    quantity,
    unit,
    quantityUnknown: quantity === null,
    quantityAssumed: false,
    preparation: null,
    category: 'OTHER',
    alternatives: [],
    nutrition:
      kcal === null
        ? null
        : {
            ...eggNutrition,
            basisQuantity: quantity,
            basisUnit: unit,
            values: { ...eggNutrition.values, ENERGY_KCAL: kcal },
          },
  });
  const reply = (
    items: MealAnalysisOutput['items'],
    extra: Partial<MealAnalysisOutput> = {},
  ): MealAnalysisOutput => ({
    items,
    suggestedSlot: null,
    suggestedOptionIndex: null,
    questions: [],
    changes: [],
    ...extra,
  });

  beforeEach(() => {
    vi.mocked(admitOperation).mockResolvedValue({ ok: true, callId: 'call-1' });
  });

  it('sends the reviewed items and the answers, keeps the link, merges by position and records the changes', async () => {
    const state = draftState({
      planSlotId: 'slot-lunch',
      planOptionId: 'opt-a',
      items: [
        draftItem({
          key: 'a',
          originalName: 'برنج',
          englishLabel: 'rice',
          quantity: 150,
          unit: 'g',
        }),
        draftItem({
          key: 'b',
          originalName: 'نان',
          englishLabel: 'bread',
          quantity: null,
          unit: null,
          quantityUnknown: true,
          nutrition: null,
        }),
      ],
      questions: [
        {
          key: 'q1',
          itemKey: 'b',
          question: 'How many slices?',
          kind: 'PORTION',
          choices: ['1 slice', '2 slices'],
          answer: '2 slices',
        },
        {
          key: 'q2',
          itemKey: 'a',
          question: 'With oil?',
          kind: 'INGREDIENT',
          choices: [],
          answer: null,
        },
      ],
    });
    const row = mealDraftFactory.build({ userId: OWNER, revision: 4, state });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(analyzeMeal).mockResolvedValue({
      ok: true,
      data: reply([aiItem('rice', 999, 'g', 999), aiItem('bread', 2, 'slice_sangak', 320)], {
        suggestedSlot: { originalName: 'Breakfast', englishLabel: 'Breakfast' },
        changes: ['Bread: 2 slices of sangak from your answer.'],
        questions: [{ itemIndex: 0, question: 'With oil?', kind: 'INGREDIENT', choices: [] }],
      }),
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 5,
    });

    await analyzeDraft(OWNER, row.id, 4, NOW, 'REFINE');

    const input = vi.mocked(analyzeMeal).mock.calls[0]?.[0];
    expect(input?.refine?.items.map((i) => [i.originalName, i.answer])).toEqual([
      ['برنج', null],
      ['نان', '2 slices'],
    ]);
    expect(input?.refine?.answers).toEqual([{ question: 'How many slices?', answer: '2 slices' }]);

    const data = prismaMock.mealDraft.updateMany.mock.calls[1]?.[0].data as {
      state: MealDraftState;
    };
    // The link stays as the user had it, whatever the model suggests.
    expect(data.state.planSlotId).toBe('slot-lunch');
    expect(data.state.planOptionId).toBe('opt-a');
    // Item a: known quantity and nutrition untouched (the model's 999 is ignored).
    expect(data.state.items[0]).toMatchObject({
      originalName: 'برنج',
      quantity: 150,
      nutrition: eggNutrition,
    });
    // Item b: the answer filled the portion and the estimate.
    expect(data.state.items[1]).toMatchObject({
      originalName: 'نان',
      quantity: 2,
      unit: 'slice_sangak',
      quantityUnknown: false,
      scaleFlag: 'SCALED',
    });
    expect(data.state.items[1]?.nutrition?.values.ENERGY_KCAL).toBe(320);
    expect(data.state.lastChanges).toEqual(['Bread: 2 slices of sangak from your answer.']);
    // The answered question is gone; the model's question replaces the unanswered one.
    expect(data.state.questions.map((q) => [q.itemKey, q.answer])).toEqual([
      [data.state.items[0]?.key, null],
    ]);
  });

  it('falls back to a plain analysis when the draft has no items yet', async () => {
    const row = mealDraftFactory.build({
      userId: OWNER,
      state: draftState({ items: [] }),
    });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(analyzeMeal).mockResolvedValue({
      ok: true,
      data: reply([aiItem('egg', 2, 'egg', 140)]),
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 5,
    });
    await analyzeDraft(OWNER, row.id, 1, NOW, 'REFINE');
    expect(vi.mocked(analyzeMeal).mock.calls[0]?.[0].refine).toBeNull();
  });

  describe('mergeRefinedItems', () => {
    it("keeps a renamed item's name and preparation and takes only the nutrition it was owed", () => {
      const current = [
        draftItem({
          key: 'a',
          originalName: 'املت',
          englishLabel: 'omelette',
          preparation: 'with oil',
          nutrition: null,
          needsReestimate: true,
          previousNutrition: eggNutrition,
        }),
      ];
      const [merged] = mergeRefinedItems(
        current,
        reply([{ ...aiItem('Egg', 2, 'egg', 210), preparation: 'boiled' }]),
      );
      expect(merged).toMatchObject({
        originalName: 'املت',
        englishLabel: 'omelette',
        preparation: 'with oil',
        needsReestimate: false,
        scaleFlag: 'SCALED',
        previousNutrition: eggNutrition,
      });
      expect(merged?.nutrition?.values.ENERGY_KCAL).toBe(210);
    });

    it('never replaces a label value the user entered', () => {
      const override = { ...eggNutrition, source: 'USER_LABEL' as const, userOverride: true };
      const current = [draftItem({ key: 'a', nutrition: override, needsReestimate: true })];
      const [merged] = mergeRefinedItems(current, reply([aiItem('egg', 2, 'egg', 500)]));
      expect(merged?.nutrition).toEqual(override);
      expect(merged?.needsReestimate).toBe(true);
    });

    it('fills a quantity only where it was unknown, keeps dropped items and appends extra ones', () => {
      const current = [
        draftItem({ key: 'a', quantity: 3, unit: 'egg' }),
        draftItem({ key: 'b', quantity: null, unit: null, quantityUnknown: true, nutrition: null }),
        draftItem({ key: 'c', originalName: 'tea', englishLabel: 'tea' }),
      ];
      // The model dropped the tea: it stays, at its position.
      const shorter = mergeRefinedItems(
        current,
        reply([aiItem('egg', 1, 'egg', 70), aiItem('bread', 80, 'g', 210)]),
      );
      expect(shorter.map((i) => [i.key, i.quantity, i.unit, i.position])).toEqual([
        ['a', 3, 'egg', 0],
        ['b', 80, 'g', 1],
        ['c', 2, 'piece', 2],
      ]);
      // A nutrition the item already held is not overwritten without a re-estimate owed.
      expect(shorter[0]?.nutrition?.values.ENERGY_KCAL).toBe(140);

      // The model added butter: appended as an added item.
      const longer = mergeRefinedItems(
        current,
        reply([
          aiItem('egg', 1, 'egg', 70),
          aiItem('bread', 80, 'g', 210),
          aiItem('tea', 1, 'glass', 30),
          aiItem('butter', 10, 'g', 75),
        ]),
      );
      expect(longer).toHaveLength(4);
      expect(longer[3]).toMatchObject({
        originalName: 'butter',
        quantity: 10,
        unit: 'g',
        position: 3,
        isAddedItem: true,
      });
    });
  });
});

describe('saveMeal', () => {
  const savedRow = (overrides = {}) => ({
    ...mealFactory.build({ id: 'meal-new', userId: OWNER, clientRequestId: REQ, ...overrides }),
    items: [foodItemFactory.build({ mealId: 'meal-new' })],
    uploads: [],
    day: dayRecordFactory.build({ userId: OWNER }),
    planSlot: null,
    planOption: null,
  });

  it('returns the existing meal on a retry after the draft is gone (TS-§21.9)', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(savedRow() as never);
    const meal = await saveMeal(OWNER, 'draft-gone', 1, REQ, NOW);
    expect(meal.id).toBe('meal-new');
    expect(prismaMock.mealDraft.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('refuses OPTION_REQUIRED when the items overlap an option of a multi-option slot and none is chosen (B3)', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.findFirst.mockResolvedValue(
      mealDraftFactory.build({
        userId: OWNER,
        clientRequestId: REQ,
        state: draftState({
          planSlotId: 'slot-lunch',
          planOptionId: null,
          items: [draftItem({ key: 'a', originalName: 'rice', englishLabel: 'rice' })],
        }),
      }),
    );
    await expect(saveMeal(OWNER, 'draft-1', 1, REQ, NOW)).rejects.toMatchObject({
      code: 'OPTION_REQUIRED',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('saves a meal that overlaps no option under the slot with no option: a different food (B3, J5)', async () => {
    useTransaction();
    const draft = mealDraftFactory.build({
      userId: OWNER,
      clientRequestId: REQ,
      state: draftState({
        planSlotId: 'slot-lunch',
        planOptionId: null,
        items: [draftItem({ key: 'a', originalName: 'ساندویچ همبرگر', englishLabel: 'burger' })],
      }),
    });
    prismaMock.meal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(savedRow({ planSlotId: 'slot-lunch', planOptionId: null }) as never);
    prismaMock.mealDraft.findFirst.mockResolvedValue(draft);
    prismaMock.dayRecord.upsert.mockResolvedValue(
      dayRecordFactory.build({ id: 'day-x', userId: OWNER }),
    );
    prismaMock.meal.create.mockResolvedValue(mealFactory.build({ id: 'meal-new', userId: OWNER }));
    prismaMock.foodItem.createMany.mockResolvedValue({ count: 1 });
    prismaMock.mealDraft.deleteMany.mockResolvedValue({ count: 1 });

    const meal = await saveMeal(OWNER, draft.id, 1, REQ, NOW);
    expect(meal.droppedPhotos).toBe(0);
    expect(prismaMock.meal.create.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: 'slot-lunch',
      planOptionId: null,
      linkConfirmedByUser: true,
    });
  });

  it('leaves out staged photos that expired and reports how many (B24)', async () => {
    useTransaction();
    const draft = mealDraftFactory.build({
      userId: OWNER,
      clientRequestId: REQ,
      state: draftState({ uploadIds: ['up-1', 'up-gone'] }),
    });
    prismaMock.meal.findFirst.mockResolvedValueOnce(null).mockResolvedValue(savedRow() as never);
    prismaMock.mealDraft.findFirst.mockResolvedValue(draft);
    prismaMock.upload.findMany.mockResolvedValue([{ id: 'up-1' }] as never);
    prismaMock.dayRecord.upsert.mockResolvedValue(
      dayRecordFactory.build({ id: 'day-x', userId: OWNER }),
    );
    prismaMock.meal.create.mockResolvedValue(mealFactory.build({ id: 'meal-new', userId: OWNER }));
    prismaMock.foodItem.createMany.mockResolvedValue({ count: 1 });
    prismaMock.upload.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mealDraft.deleteMany.mockResolvedValue({ count: 1 });

    const meal = await saveMeal(OWNER, draft.id, 1, REQ, NOW);
    expect(meal.droppedPhotos).toBe(1);
    expect(prismaMock.upload.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.upload.updateMany.mock.calls[0]?.[0].where).toMatchObject({ id: 'up-1' });
  });

  it('refuses FUTURE_TIME for a later time today and for tomorrow even with an unknown time', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.findFirst.mockResolvedValue(
      mealDraftFactory.build({
        userId: OWNER,
        state: draftState({ localDate: '2026-09-17', time: '23:00' }),
      }),
    );
    await expect(saveMeal(OWNER, 'draft-1', 1, REQ, NOW)).rejects.toMatchObject({
      code: 'FUTURE_TIME',
    });
    prismaMock.mealDraft.findFirst.mockResolvedValue(
      mealDraftFactory.build({
        userId: OWNER,
        state: draftState({ localDate: '2026-09-18', time: null }),
      }),
    );
    await expect(saveMeal(OWNER, 'draft-1', 1, REQ, NOW)).rejects.toMatchObject({
      code: 'FUTURE_TIME',
    });
  });

  it('refuses a stale revision with CONFLICT', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.findFirst.mockResolvedValue(
      mealDraftFactory.build({ userId: OWNER, revision: 4 }),
    );
    await expect(saveMeal(OWNER, 'draft-1', 3, REQ, NOW)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { currentRevision: 4 },
    });
  });

  it('saves in one transaction, unskips the slot, attaches uploads, deletes the draft and marks staleness', async () => {
    useTransaction();
    const draft = mealDraftFactory.build({
      userId: OWNER,
      clientRequestId: REQ,
      state: draftState({
        localDate: '2026-09-17',
        time: '08:30',
        planSlotId: 'slot-breakfast',
        planOptionId: null,
        uploadIds: ['up-1'],
        items: [
          draftItem({
            key: 'a',
            originalName: 'egg',
            englishLabel: 'egg',
            quantity: 2,
            unit: 'piece',
          }),
        ],
      }),
    });
    prismaMock.meal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(
        savedRow({ planSlotId: 'slot-breakfast', planOptionId: 'opt-bf' }) as never,
      );
    prismaMock.mealDraft.findFirst.mockResolvedValue(draft);
    prismaMock.upload.findMany.mockResolvedValue([{ id: 'up-1' }] as never);
    prismaMock.dayRecord.upsert.mockResolvedValue(
      dayRecordFactory.build({ id: 'day-x', userId: OWNER }),
    );
    prismaMock.meal.create.mockResolvedValue(mealFactory.build({ id: 'meal-new', userId: OWNER }));
    prismaMock.foodItem.createMany.mockResolvedValue({ count: 1 });
    prismaMock.upload.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mealDraft.deleteMany.mockResolvedValue({ count: 1 });

    const meal = await saveMeal(OWNER, draft.id, 1, REQ, NOW);

    expect(meal.id).toBe('meal-new');
    expect(meal.droppedPhotos).toBe(0);
    expect(prismaMock.dayRecord.upsert.mock.calls[0]?.[0].create).toMatchObject({
      localDate: '2026-09-17',
      timeZone: 'Asia/Dubai',
    });
    expect(prismaMock.daySkippedSlot.deleteMany).toHaveBeenCalledWith({
      where: { dayRecordId: 'day-x', planSlotId: 'slot-breakfast' },
    });
    expect(prismaMock.meal.create.mock.calls[0]?.[0].data).toMatchObject({
      clientRequestId: REQ,
      dayRecordId: 'day-x',
      planSlotId: 'slot-breakfast',
      planOptionId: 'opt-bf',
      linkConfirmedByUser: true,
    });
    const items = prismaMock.foodItem.createMany.mock.calls[0]?.[0]?.data as Array<{
      matchedPlanItemId: string | null;
    }>;
    expect(items?.[0]?.matchedPlanItemId).toBe('pi-egg');
    expect(prismaMock.upload.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'up-1', userId: OWNER, status: 'STAGED' },
      data: { status: 'ATTACHED', mealId: 'meal-new', position: 0, expiresAt: null },
    });
    expect(prismaMock.mealDraft.deleteMany).toHaveBeenCalledWith({ where: { id: draft.id } });
    expect(markStaleIfNeeded).toHaveBeenCalledWith(OWNER, '2026-09-17');
  });

  it('propagates unexpected errors untouched', async () => {
    prismaMock.meal.findFirst.mockRejectedValue(new Error('boom'));
    await expect(saveMeal(OWNER, 'd', 1, REQ, NOW)).rejects.toThrow('boom');
    await expect(saveMeal(OWNER, 'd', 1, REQ, NOW)).rejects.not.toBeInstanceOf(ServiceError);
  });
});

describe('deleteMeal', () => {
  it('marks the uploads REMOVED, then deletes their objects best-effort (B12)', async () => {
    useTransaction();
    const row = {
      ...mealFactory.build({ id: 'meal-1', userId: OWNER, revision: 2 }),
      items: [],
      uploads: [
        uploadFactory.build({ id: 'up-1', storageKey: 'uploads/user-1/up-1.jpg' }),
        uploadFactory.build({ id: 'up-2', storageKey: 'uploads/user-1/up-2.jpg' }),
      ],
      day: dayRecordFactory.build({ userId: OWNER, localDate: '2026-09-17' }),
      planSlot: null,
      planOption: null,
    };
    prismaMock.meal.findFirst.mockResolvedValue(row as never);
    prismaMock.meal.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.upload.updateMany.mockResolvedValue({ count: 2 });

    await deleteMeal(OWNER, 'meal-1', 2);

    expect(prismaMock.upload.updateMany).toHaveBeenCalledWith({
      where: { userId: OWNER, mealId: 'meal-1' },
      data: { status: 'REMOVED', mealId: null },
    });
    expect(deleteObjects).toHaveBeenCalledWith([
      'uploads/user-1/up-1.jpg',
      'uploads/user-1/up-2.jpg',
    ]);
    expect(markStaleIfNeeded).toHaveBeenCalledWith(OWNER, '2026-09-17');
  });
});

describe('setMealLink', () => {
  const linkedRow = (items: ReturnType<typeof foodItemFactory.build>[]) => ({
    ...mealFactory.build({ id: 'meal-1', userId: OWNER, revision: 1 }),
    items,
    uploads: [],
    day: dayRecordFactory.build({ userId: OWNER, localDate: '2026-09-17' }),
    planSlot: null,
    planOption: null,
  });

  it('applies the same option rule: a burger links to Lunch without an option, rice needs one', async () => {
    useTransaction();
    prismaMock.meal.findFirst.mockResolvedValue(
      linkedRow([
        foodItemFactory.build({ originalName: 'burger', englishLabel: 'burger' }),
      ]) as never,
    );
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });
    await setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', null);
    expect(prismaMock.meal.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: 'slot-lunch',
      planOptionId: null,
    });

    prismaMock.meal.findFirst.mockResolvedValue(
      linkedRow([foodItemFactory.build({ originalName: 'rice', englishLabel: 'rice' })]) as never,
    );
    await expect(setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', null)).rejects.toMatchObject({
      code: 'OPTION_REQUIRED',
    });
  });
});

describe('discardDraft', () => {
  it('deletes the staged photos then the draft, and tolerates a photo already gone', async () => {
    const row = mealDraftFactory.build({
      userId: OWNER,
      state: draftState({ uploadIds: ['up-1', 'up-gone'] }),
    });
    prismaMock.mealDraft.findFirst.mockResolvedValue(row);
    prismaMock.mealDraft.deleteMany.mockResolvedValue({ count: 1 });
    vi.mocked(deleteStagedUpload)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ServiceError('gone', 'NOT_FOUND'));

    await discardDraft(OWNER, row.id);

    expect(deleteStagedUpload).toHaveBeenCalledTimes(2);
    expect(prismaMock.mealDraft.deleteMany).toHaveBeenCalledWith({
      where: { id: row.id, userId: OWNER },
    });
  });

  it("is a no-op for a draft that is not the owner's or already gone", async () => {
    prismaMock.mealDraft.findFirst.mockResolvedValue(null);
    await discardDraft(OWNER, 'someone-elses');
    expect(prismaMock.mealDraft.deleteMany).not.toHaveBeenCalled();
  });
});
