import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import {
  dayRecordFactory,
  eggNutrition,
  foodItemFactory,
  mealDraftFactory,
  mealFactory,
  profileFactory,
} from '@/__tests__/factories';
import type { RubricSlot } from '@/lib/rubric/types';
import { t } from '@/lib/t';
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

import { getActivePlan } from '@/services/plan.service';
import { getProfile, toProfileView } from '@/services/profile.service';
import { markStaleIfNeeded } from '@/services/reflection.service';
import { resetRecentMealsCache, reuseMeal, setMealLink } from '@/services/meal.service';

/**
 * Meal details actions (improvement plan B28): "Change plan link"
 * (`setMealLink`) and "Reuse as new meal" (`reuseMeal`). The plan is the
 * same two-slot menu as meal.service.test.ts plus one Friday-only slot.
 */
resetPrismaMock();

const OWNER = 'user-1';
/** 10:00 in Asia/Dubai on 2026-09-17 (a Thursday). */
const NOW = new Date('2026-09-17T06:00:00Z');
const THURSDAY = '2026-09-17';
const REQ = '11111111-1111-4111-8111-111111111111';

const planItem = (id: string, name: string, quantity: number | null, extra = {}) => ({
  id,
  originalName: name,
  englishLabel: name,
  quantity,
  unit: quantity === null ? null : 'g',
  unitGrams: null,
  quantityAssumed: false,
  category: 'OTHER' as const,
  alternatives: [],
  nutrition: eggNutrition,
  ...extra,
});

const breakfast: RubricSlot = {
  id: 'slot-breakfast',
  weekday: 7,
  position: 0,
  originalName: 'صبحانه',
  englishLabel: 'Breakfast',
  timeStart: null,
  timeEnd: null,
  options: [
    {
      id: 'opt-bf',
      position: 0,
      label: null,
      items: [planItem('pi-egg', 'egg', 2, { unit: 'piece', unitGrams: 50 })],
    },
  ],
};

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

/** A slot that applies on Fridays only (weekday 5). */
const fridayDinner: RubricSlot = {
  id: 'slot-friday-dinner',
  weekday: 5,
  position: 2,
  originalName: 'شام جمعه',
  englishLabel: 'Friday dinner',
  timeStart: null,
  timeEnd: null,
  options: [{ id: 'opt-fd', position: 0, label: null, items: [planItem('pi-fish', 'fish', 150)] }],
};

function plan(slots: RubricSlot[]) {
  return {
    id: 'plan-1',
    status: 'ACTIVE' as const,
    structure: 'BY_WEEKDAY' as const,
    name: null,
    sourceNote: null,
    confirmedAt: NOW,
    createdAt: NOW,
    slots,
    targets: [],
    notes: [],
    draft: null,
  };
}

/** A saved meal row on Thursday with the given items and link, as `loadMeal` returns it. */
function mealRow(
  items: ReturnType<typeof foodItemFactory.build>[],
  overrides: Partial<ReturnType<typeof mealFactory.build>> = {},
) {
  return {
    ...mealFactory.build({ id: 'meal-1', userId: OWNER, revision: 1, ...overrides }),
    items,
    uploads: [],
    day: dayRecordFactory.build({ id: 'day-1', userId: OWNER, localDate: THURSDAY }),
    planSlot: null,
  };
}

const rice = () =>
  foodItemFactory.build({
    id: 'item-rice',
    originalName: 'برنج',
    englishLabel: 'rice',
    quantity: new Prisma.Decimal(150),
    unit: 'g',
    unitGrams: null,
    category: 'RICE',
  });
const burger = () =>
  foodItemFactory.build({
    id: 'item-burger',
    originalName: 'همبرگر',
    englishLabel: 'burger',
    category: 'MEAT',
  });
const egg = () =>
  foodItemFactory.build({ id: 'item-egg', originalName: 'تخم‌مرغ', englishLabel: 'egg' });

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
      profileFactory.build({ userId: OWNER, restrictionsOriginal: [], restrictions: [] }),
    ),
  );
  vi.mocked(getActivePlan).mockResolvedValue(plan([breakfast, lunch, fridayDinner]));
});

describe('setMealLink (meal details › Change plan link)', () => {
  it('moves a meal to another slot: the option is resolved against the new slot, the new slot is unskipped, the day is marked', async () => {
    useTransaction();
    const row = mealRow([rice()], { planSlotId: 'slot-breakfast', planOptionId: 'opt-bf' });
    prismaMock.meal.findFirst.mockResolvedValueOnce(row as never).mockResolvedValue({
      ...row,
      planSlotId: 'slot-lunch',
      planOptionId: 'opt-a',
      revision: 2,
    } as never);
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });

    const meal = await setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', 'opt-a');

    expect(prismaMock.meal.updateMany).toHaveBeenCalledWith({
      where: { id: 'meal-1', userId: OWNER, revision: 1 },
      data: {
        planSlotId: 'slot-lunch',
        planOptionId: 'opt-a',
        linkConfirmedByUser: true,
        revision: 2,
      },
    });
    expect(prismaMock.daySkippedSlot.deleteMany).toHaveBeenCalledWith({
      where: { dayRecordId: 'day-1', planSlotId: 'slot-lunch' },
    });
    expect(markStaleIfNeeded).toHaveBeenCalledWith(OWNER, THURSDAY);
    expect(meal).toMatchObject({ planSlotId: 'slot-lunch', planOptionId: 'opt-a', revision: 2 });
  });

  it('refuses an option that belongs to the old slot rather than the new one, and does not write', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(
      mealRow([egg()], { planSlotId: 'slot-breakfast', planOptionId: 'opt-bf' }) as never,
    );
    await expect(setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', 'opt-bf')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: t('meal.errors.optionNotInSlot'),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('clears the option when the new slot has none matching the items (a different food under the slot)', async () => {
    useTransaction();
    const row = mealRow([burger()], { planSlotId: 'slot-breakfast', planOptionId: 'opt-bf' });
    prismaMock.meal.findFirst.mockResolvedValue(row as never);
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });

    await setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', null);

    expect(prismaMock.meal.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: 'slot-lunch',
      planOptionId: null,
    });
  });

  it('resolves the option by itself on a single-option slot', async () => {
    useTransaction();
    const row = mealRow([rice()], { planSlotId: 'slot-lunch', planOptionId: 'opt-a' });
    prismaMock.meal.findFirst.mockResolvedValue(row as never);
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });

    await setMealLink(OWNER, 'meal-1', 1, 'slot-breakfast', null);

    expect(prismaMock.meal.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: 'slot-breakfast',
      planOptionId: 'opt-bf',
    });
  });

  it("refuses a slot that does not apply on the meal's day", async () => {
    prismaMock.meal.findFirst.mockResolvedValue(mealRow([rice()]) as never);
    // The meal is on a Thursday; the slot is Friday-only.
    await expect(setMealLink(OWNER, 'meal-1', 1, 'slot-friday-dinner', null)).rejects.toMatchObject(
      { code: 'NOT_FOUND', message: t('meal.errors.slotNotOnDay') },
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(markStaleIfNeeded).not.toHaveBeenCalled();
  });

  it('owes an option only when the items overlap one of the new slot’s options; the planned-path rule does not apply on a relink', async () => {
    useTransaction();
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });

    // Rice overlaps lunch option A: an option is owed.
    prismaMock.meal.findFirst.mockResolvedValue(mealRow([rice()]) as never);
    await expect(setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', null)).rejects.toMatchObject({
      code: 'OPTION_REQUIRED',
    });
    expect(prismaMock.meal.updateMany).not.toHaveBeenCalled();

    // A burger overlaps nothing: it links to lunch with no option, even though the meal
    // was originally logged through "I ate this" (kind is not re-applied on a relink).
    prismaMock.meal.findFirst.mockResolvedValue(
      mealRow([burger()], { inputKind: 'PLANNED' }) as never,
    );
    await setMealLink(OWNER, 'meal-1', 1, 'slot-lunch', null);
    expect(prismaMock.meal.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: 'slot-lunch',
      planOptionId: null,
    });
  });

  it('unlinks to Other with no unskip, and refuses a stale revision with CONFLICT', async () => {
    useTransaction();
    prismaMock.meal.findFirst.mockResolvedValue(
      mealRow([rice()], { planSlotId: 'slot-lunch', planOptionId: 'opt-a' }) as never,
    );
    prismaMock.meal.updateMany.mockResolvedValue({ count: 1 });
    await setMealLink(OWNER, 'meal-1', 1, null, null);
    expect(prismaMock.daySkippedSlot.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.meal.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      planSlotId: null,
      planOptionId: null,
      linkConfirmedByUser: true,
    });

    await expect(setMealLink(OWNER, 'meal-1', 3, null, null)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { currentRevision: 1 },
    });
  });
});

describe('reuseMeal (meal details › Reuse as new meal)', () => {
  const source = () =>
    mealRow([rice(), burger()], {
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      inputKind: 'TEXT',
      planSlotId: 'slot-lunch',
      planOptionId: 'opt-a',
      notes: 'with extra sauce',
    });

  /** `loadMeal` reads by id; `findMealByClientRequestId` by the new request id. */
  function loadsSource(saved: ReturnType<typeof mealRow> | null = null) {
    prismaMock.meal.findFirst.mockImplementation((async (args: {
      where: { clientRequestId?: string };
    }) => (args.where.clientRequestId ? saved : source())) as never);
  }

  function createdState(): MealDraftState {
    const call = prismaMock.mealDraft.create.mock.calls[0]?.[0];
    return call?.data.state as MealDraftState;
  }

  it('copies items, nutrition and the link into a fresh RECENT draft under the new clientRequestId, and never touches the original', async () => {
    loadsSource();
    prismaMock.mealDraft.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.create.mockImplementation((async (args: { data: unknown }) =>
      mealDraftFactory.build({
        ...(args.data as object),
        id: 'draft-new',
        userId: OWNER,
      })) as never);

    const result = await reuseMeal(OWNER, 'meal-1', REQ, THURSDAY, NOW);

    expect(result.meal).toBeNull();
    expect(result.draft?.clientRequestId).toBe(REQ);
    expect(prismaMock.mealDraft.create.mock.calls[0]?.[0].data).toMatchObject({
      userId: OWNER,
      clientRequestId: REQ,
    });
    const state = createdState();
    expect(state).toMatchObject({
      kind: 'RECENT',
      text: null,
      localDate: THURSDAY,
      time: '10:00',
      planSlotId: 'slot-lunch',
      planOptionId: 'opt-a',
      copiedFromMealId: 'meal-1',
      notes: null,
    });
    // Items are copies: same food, portion and nutrition, new keys, re-matched against the option.
    expect(state.items.map((i) => [i.originalName, i.englishLabel, i.quantity, i.unit])).toEqual([
      ['برنج', 'rice', 150, 'g'],
      ['همبرگر', 'burger', 2, 'piece'],
    ]);
    expect(state.items[0]?.nutrition).toEqual(eggNutrition);
    expect(state.items.map((i) => i.key)).not.toContain('item-rice');
    expect(state.items.map((i) => i.key)).not.toContain('item-burger');
    expect(state.items[0]?.matchedPlanItemId).toBe('pi-rice');
    expect(state.items[1]?.isAddedItem).toBe(true);

    // The source meal is read, never written.
    expect(prismaMock.meal.update).not.toHaveBeenCalled();
    expect(prismaMock.meal.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.meal.delete).not.toHaveBeenCalled();
    expect(prismaMock.foodItem.update).not.toHaveBeenCalled();
    expect(prismaMock.foodItem.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.foodItem.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps the link on a past day of the same weekday with the time left unknown, and drops it on another weekday', async () => {
    loadsSource();
    prismaMock.mealDraft.findFirst.mockResolvedValue(null);
    prismaMock.mealDraft.create.mockImplementation((async (args: { data: unknown }) =>
      mealDraftFactory.build({ ...(args.data as object), userId: OWNER })) as never);

    // The Thursday before: same weekday, so the lunch link carries over; no clock time is borrowed.
    await reuseMeal(OWNER, 'meal-1', REQ, '2026-09-10', NOW);
    expect(createdState()).toMatchObject({
      localDate: '2026-09-10',
      time: null,
      planSlotId: 'slot-lunch',
      planOptionId: 'opt-a',
    });

    // The day before (a Wednesday): the link is not assumed.
    prismaMock.mealDraft.create.mockClear();
    await reuseMeal(OWNER, 'meal-1', '33333333-3333-4333-8333-333333333333', '2026-09-16', NOW);
    expect(createdState()).toMatchObject({
      localDate: '2026-09-16',
      time: null,
      planSlotId: null,
      planOptionId: null,
    });
    expect(createdState().items).toHaveLength(2);
  });

  it('returns the meal already saved for the same clientRequestId instead of a second draft', async () => {
    const saved = mealRow([rice()], { id: 'meal-saved', clientRequestId: REQ });
    loadsSource(saved);

    const result = await reuseMeal(OWNER, 'meal-1', REQ, THURSDAY, NOW);

    expect(result.draft).toBeNull();
    expect(result.meal).toMatchObject({ id: 'meal-saved', clientRequestId: REQ });
    expect(prismaMock.mealDraft.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.mealDraft.create).not.toHaveBeenCalled();
  });

  it('returns the existing draft when the request was already opened (a retry), without a second copy', async () => {
    loadsSource();
    const existing = mealDraftFactory.build({
      id: 'draft-open',
      userId: OWNER,
      clientRequestId: REQ,
    });
    prismaMock.mealDraft.findFirst.mockResolvedValue(existing);

    const result = await reuseMeal(OWNER, 'meal-1', REQ, THURSDAY, NOW);

    expect(result.draft?.id).toBe('draft-open');
    expect(prismaMock.mealDraft.create).not.toHaveBeenCalled();
  });
});
