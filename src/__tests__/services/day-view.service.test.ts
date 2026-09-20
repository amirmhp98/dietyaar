import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type FoodItem } from '@prisma/client';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import {
  dayRecordFactory,
  foodItemFactory,
  mealFactory,
  profileFactory,
} from '@/__tests__/factories';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import type { RubricPlanItem, RubricSlot } from '@/lib/rubric/types';
import { APP_TIME_ZONE } from '@/lib/time/zone';

// plan.service → reflection.service → day-view.service → plan.service is a cycle, so the
// mock cannot load the original module; `slotsForWeekday` is restated here.
vi.mock('@/services/plan.service', () => ({
  getActivePlan: vi.fn(),
  slotsForWeekday: (plan: { slots: RubricSlot[] }, weekday: number) =>
    plan.slots
      .filter((s) => s.weekday === 7 || s.weekday === weekday)
      .sort((a, b) => a.position - b.position),
}));
vi.mock('@/services/profile.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/profile.service')>()),
  getProfile: vi.fn(),
}));

import { getActivePlan, type ActivePlan } from '@/services/plan.service';
import { getProfile, toProfileView } from '@/services/profile.service';
import {
  dayRowState,
  getDayView,
  getSevenDayView,
  historyStartFor,
} from '@/services/day-view.service';

resetPrismaMock();

const OWNER = 'user-1';
/** Stored days are written in the app zone (decision 022). */
const ZONE = APP_TIME_ZONE;
/** 2026-09-16 is a Wednesday; the profile's week starts on Saturday (6). */
const DATE = '2026-09-16';
/** 2026-09-17 12:30 in Asia/Dubai. */
const NOW = new Date('2026-09-17T08:30:00Z');

function activePlan(overrides: Partial<ActivePlan> = {}) {
  const p = buildMenuPlan();
  const plan: ActivePlan = {
    id: 'plan-1',
    status: 'ACTIVE',
    structure: 'SAME_EVERY_DAY',
    name: null,
    sourceNote: null,
    confirmedAt: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-08-30T00:00:00Z'),
    slots: p.slots,
    targets: p.targets.map((t, i) => ({ ...t, id: `target-${i}`, weekday: null })),
    notes: [],
    draft: null,
    ...overrides,
  };
  return { plan, ...p };
}

/** A recorded item copying a plan item at the prescribed amount. */
function itemFrom(planItem: RubricPlanItem, mealId: string, quantity?: number): FoodItem {
  return foodItemFactory.build({
    mealId,
    originalName: planItem.originalName,
    englishLabel: planItem.englishLabel,
    quantity: new Prisma.Decimal(quantity ?? planItem.quantity ?? 0),
    unit: planItem.unit,
    category: planItem.category,
    matchedPlanItemId: planItem.id,
    nutrition: planItem.nutrition
      ? { ...planItem.nutrition, values: { ...planItem.nutrition.values } }
      : null,
  });
}

function mealRow(
  id: string,
  planSlotId: string | null,
  planOptionId: string | null,
  time: string | null,
  items: FoodItem[],
  dayRecordId = 'day-1',
) {
  return {
    ...mealFactory.build({ id, planSlotId, planOptionId, consumedLocalTime: time, dayRecordId }),
    items,
    uploads: [],
  };
}

function dayRow(localDate: string, meals: ReturnType<typeof mealRow>[], overrides = {}) {
  return {
    ...dayRecordFactory.build({ id: 'day-1', localDate, timeZone: ZONE, ...overrides }),
    meals,
    skippedSlots: [],
  };
}

/** The profile (and so the account) dates from 2026-09-10 unless a test says otherwise. */
function useProfile(overrides: Partial<Parameters<typeof profileFactory.build>[0]> = {}) {
  vi.mocked(getProfile).mockResolvedValue(
    toProfileView(profileFactory.build({ userId: OWNER, weekStart: 6, ...overrides })),
  );
}

beforeEach(() => {
  useProfile();
  prismaMock.dayRecord.findMany.mockResolvedValue([]);
});

describe('getDayView', () => {
  it('lunch in two sittings → one slot score, coverage 1 of 5, nutrition counts both (TS-§21.3)', async () => {
    const { plan, lunch } = activePlan();
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    const opt = lunch.options[0];
    prismaMock.dayRecord.findUnique.mockResolvedValue(
      dayRow(DATE, [
        mealRow('m1', lunch.id, opt.id, '13:00', [itemFrom(opt.items[0], 'm1')]),
        mealRow('m2', lunch.id, opt.id, '14:30', [
          itemFrom(opt.items[1], 'm2'),
          itemFrom(opt.items[3], 'm2'),
        ]),
      ]) as never,
    );

    const result = await getDayView(OWNER, DATE, NOW);
    const slot = result.view.slots[2];
    expect(slot.state).toBe('RECORDED');
    expect(slot.mealIds).toEqual(['m1', 'm2']);
    expect(slot.match?.status).toBe('MATCHED');
    expect(result.view.score.coverage).toMatchObject({ prescribed: 5, recorded: 1, scored: 1 });
    expect(result.view.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL')?.subtotal.value).toBe(
      435,
    );
    expect(result.view.contributing).toEqual([
      { mealId: 'm1', revision: 1 },
      { mealId: 'm2', revision: 1 },
    ]);
    expect(result.meals).toHaveLength(2);
    expect(result.meals[0]).toMatchObject({
      id: 'm1',
      slot: { englishLabel: 'Lunch' },
      energyKcal: 195,
    });
    expect(result.zone).toBe(ZONE);
  });

  it('different options in two sittings → NEEDS_REVIEW, excluded from the score (TS-§21.4)', async () => {
    const { plan, lunch } = activePlan();
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    const [o1, o2] = lunch.options;
    prismaMock.dayRecord.findUnique.mockResolvedValue(
      dayRow(DATE, [
        mealRow('m1', lunch.id, o1.id, '13:00', [itemFrom(o1.items[0], 'm1')]),
        mealRow('m2', lunch.id, o2.id, '14:00', [itemFrom(o2.items[0], 'm2')]),
      ]) as never,
    );

    const { view } = await getDayView(OWNER, DATE, NOW);
    expect(view.slots[2].state).toBe('NEEDS_REVIEW');
    expect(view.slots[2].score).toBeNull();
    expect(view.score.coverage.needsReview).toBe(1);
    expect(view.score.coverage.scored).toBe(0);
  });

  it('midnight without edits: 23:59 is In progress, 00:01 is a past day with nutrition applied (TS-§21.5)', async () => {
    const { plan, lunch } = activePlan();
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    const opt = lunch.options[0];
    const row = dayRow(DATE, [
      mealRow(
        'm1',
        lunch.id,
        opt.id,
        '13:00',
        opt.items.filter((i) => i.quantity !== null).map((i) => itemFrom(i, 'm1')),
      ),
    ]);
    prismaMock.dayRecord.findUnique.mockResolvedValue(row as never);

    // 2026-09-16 23:59 in Asia/Dubai (UTC+4) = 19:59Z; 2026-09-17 00:01 = 20:01Z.
    const before = await getDayView(OWNER, DATE, new Date('2026-09-16T19:59:00Z'));
    const after = await getDayView(OWNER, DATE, new Date('2026-09-16T20:01:00Z'));
    const energy = (v: typeof before) => v.view.nutrition.find((n) => n.nutrient === 'ENERGY_KCAL');
    expect(before.view.dayPhase).toBe('ONGOING');
    expect(before.view.score.nutritionComponent).toBeNull();
    expect(energy(before)?.status).toBe('PROGRESS');
    expect(after.view.dayPhase).toBe('PAST');
    expect(after.view.score.nutritionComponent).not.toBeNull();
    expect(energy(after)?.status).toBe('BELOW_RANGE');
  });

  it('past day, checked, 2 of 5 → complete by default and out of the trend denominator', async () => {
    const { plan, breakfast, lunch } = activePlan();
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    const b = breakfast.options[0];
    const l = lunch.options[0];
    prismaMock.dayRecord.findUnique.mockResolvedValue(
      dayRow(DATE, [
        mealRow('m1', breakfast.id, b.id, '08:00', [itemFrom(b.items[0], 'm1')]),
        mealRow('m2', lunch.id, l.id, '13:00', [itemFrom(l.items[0], 'm2')]),
      ]) as never,
    );

    const { view } = await getDayView(OWNER, DATE, NOW);
    expect(view.dayPhase).toBe('PAST');
    expect(view.logComplete).toBe(true);
    expect(view.score.completeByDefault).toBe(true);
    expect(view.score.coverage).toMatchObject({ recorded: 2, prescribed: 5, notRecorded: 3 });
    expect(view.trendEligible).toBe(false);
    expect(dayRowState(view)).toBe('COMPLETE_BY_DEFAULT');
  });

  it('a date without a row is an empty day in the profile zone', async () => {
    vi.mocked(getActivePlan).mockResolvedValue(activePlan().plan);
    prismaMock.dayRecord.findUnique.mockResolvedValue(null);

    const result = await getDayView(OWNER, DATE, NOW);
    expect(result.view.hasRecord).toBe(false);
    expect(result.view.mealCount).toBe(0);
    expect(result.view.logComplete).toBe(true);
    expect(result.view.slots.every((s) => s.state === 'NOT_RECORDED')).toBe(true);
    expect(result.zone).toBe(ZONE);
    expect(dayRowState(result.view)).toBe('NO_MEALS');
  });

  it('a stored day keeps its own zone; no plan → no slots', async () => {
    vi.mocked(getActivePlan).mockResolvedValue(null);
    prismaMock.dayRecord.findUnique.mockResolvedValue(
      dayRow(DATE, [], { timeZone: 'Europe/Berlin' }) as never,
    );

    const result = await getDayView(OWNER, DATE, NOW);
    expect(result.zone).toBe('Europe/Berlin');
    expect(result.view.planStructure).toBeNull();
    expect(result.view.slots).toEqual([]);
    expect(result.plan).toBeNull();
  });

  it('reads one day only: no range query', async () => {
    vi.mocked(getActivePlan).mockResolvedValue(activePlan().plan);
    prismaMock.dayRecord.findUnique.mockResolvedValue(null);
    await getDayView(OWNER, DATE, NOW);
    expect(prismaMock.dayRecord.findMany).not.toHaveBeenCalled();
  });
});

describe('getSevenDayView', () => {
  it('summarises seven days from one range query and flags a plan confirmed inside the window', async () => {
    const { plan, lunch } = activePlan({ confirmedAt: new Date('2026-09-13T10:00:00Z') });
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    const opt = lunch.options[0];
    const rows = ['2026-09-12', '2026-09-13', '2026-09-14'].map((date, i) => ({
      ...dayRecordFactory.build({ id: `day-${i}`, localDate: date, timeZone: ZONE }),
      meals: [
        mealRow(
          `m-${i}`,
          lunch.id,
          opt.id,
          '13:00',
          [itemFrom(opt.items[0], `m-${i}`)],
          `day-${i}`,
        ),
      ],
      skippedSlots: [],
    }));
    prismaMock.dayRecord.findMany.mockResolvedValue(rows as never);

    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.startDate).toBe('2026-09-11');
    expect(prismaMock.dayRecord.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.dayRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER, localDate: { gte: '2026-09-11', lte: '2026-09-17' } },
      }),
    );
    expect(result.rows).toHaveLength(7);
    expect(result.rows.map((r) => r.localDate)).toEqual([
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
    expect(result.rows[6].state).toBe('IN_PROGRESS');
    expect(result.rows[0].state).toBe('NO_MEALS');
    // Three checked days with unrecorded slots: complete by default, so not trend-eligible.
    expect(result.rows[1].state).toBe('COMPLETE_BY_DEFAULT');
    expect(result.summary).toMatchObject({ kind: 'NOT_ENOUGH', completeDays: 0 });
    expect(result.planChangedInWindow).toBe(true);
  });

  it("lists days from the account's first day and says where history starts", async () => {
    useProfile({ createdAt: new Date('2026-09-14T05:00:00Z') });
    vi.mocked(getActivePlan).mockResolvedValue(activePlan().plan);
    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.historyStart).toBe('2026-09-14');
    expect(result.rows.map((r) => r.localDate)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
    expect(result.startDate).toBe('2026-09-11');
  });

  it('keeps an earlier day the user logged a meal for, back to that day', async () => {
    useProfile({ createdAt: new Date('2026-09-15T05:00:00Z') });
    const { plan, lunch } = activePlan();
    vi.mocked(getActivePlan).mockResolvedValue(plan);
    prismaMock.dayRecord.findMany.mockResolvedValue([
      dayRow('2026-09-13', [
        mealRow('m1', lunch.id, lunch.options[0].id, '13:00', [
          itemFrom(lunch.options[0].items[0], 'm1'),
        ]),
      ]),
    ] as never);
    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.historyStart).toBe('2026-09-13');
    expect(result.rows.map((r) => r.localDate)).toEqual([
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
  });

  it('does not flag a plan confirmed before the window', async () => {
    vi.mocked(getActivePlan).mockResolvedValue(activePlan().plan);
    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.planChangedInWindow).toBe(false);
  });

  it('does not flag a first plan: confirmed on the day its row was created', async () => {
    // Import started 09:30 Dubai, confirmed 09:50 the same local day.
    vi.mocked(getActivePlan).mockResolvedValue(
      activePlan({
        createdAt: new Date('2026-09-13T05:30:00Z'),
        confirmedAt: new Date('2026-09-13T05:50:00Z'),
      }).plan,
    );
    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.planChangedInWindow).toBe(false);
  });

  it('flags an edit confirmed on a later day than the row was created', async () => {
    vi.mocked(getActivePlan).mockResolvedValue(
      activePlan({
        createdAt: new Date('2026-09-10T05:30:00Z'),
        confirmedAt: new Date('2026-09-13T05:50:00Z'),
      }).plan,
    );
    const result = await getSevenDayView(OWNER, '2026-09-17', NOW);
    expect(result.planChangedInWindow).toBe(true);
  });
});

describe('historyStartFor', () => {
  it('is null when the account predates the window, else the earlier of account and first record', () => {
    expect(historyStartFor('2026-09-11', '2026-09-01', [])).toBeNull();
    expect(historyStartFor('2026-09-11', '2026-09-11', [])).toBeNull();
    expect(historyStartFor('2026-09-11', null, [])).toBeNull();
    expect(historyStartFor('2026-09-11', '2026-09-14', [])).toBe('2026-09-14');
    expect(historyStartFor('2026-09-11', '2026-09-14', ['2026-09-16', '2026-09-12'])).toBe(
      '2026-09-12',
    );
    // A record before the window: the whole window is history.
    expect(historyStartFor('2026-09-11', '2026-09-14', ['2026-09-05'])).toBeNull();
  });
});
