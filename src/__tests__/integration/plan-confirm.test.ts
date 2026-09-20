import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { createTestUser, resetDatabase } from '@/__tests__/integration/db';

vi.mock('@/services/ai/interpret-plan', () => ({
  interpretPlan: vi.fn(),
  estimatePlanBaseline: vi.fn(),
}));

import { finalizeJob, type ClaimedJob } from '@/services/jobs/plan-import.job';
import {
  confirmPlan,
  countAffectedMeals,
  getActivePlan,
  startEdit,
  startImport,
  startManual,
  updateDraft,
} from '@/services/plan.service';

/**
 * Tech spec § 21.1–2 and decision 017 (amended): an edit keeps row ids and
 * meal links; removed options drop the link's option; removed slots send
 * meals to "Other"; a stale `draftId` finalize affects zero rows.
 */

const nutrition = (kcal: number) => ({
  basis: 'PER_RECORDED_PORTION',
  basisQuantity: null,
  basisUnit: null,
  values: {
    ENERGY_KCAL: kcal,
    PROTEIN_G: null,
    CARB_G: null,
    FAT_G: null,
    FIBER_G: null,
    SODIUM_MG: null,
  },
  source: 'AI_ESTIMATE',
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
});

const item = (
  key: string,
  name: [string, string],
  quantity: number,
  unit: string,
  kcal: number,
) => ({
  key,
  position: 0,
  originalName: name[0],
  englishLabel: name[1],
  quantity,
  unit,
  quantityAssumed: false,
  assumedDefaultKey: null,
  preparationNote: null,
  alternatives: [],
  category: 'OTHER',
  nutrition: nutrition(kcal),
  sourceExcerpt: '',
  needsEstimate: false,
});

/** Same-every-day plan: breakfast with two options, lunch with one. */
function manualSlots() {
  return [
    {
      key: 'breakfast',
      weekday: 7,
      position: 0,
      originalName: 'صبحانه',
      englishLabel: 'Breakfast',
      timeStart: null,
      timeEnd: null,
      sourceExcerpt: '',
      reviewed: true,
      options: [
        {
          key: 'b1',
          position: 0,
          label: 'گزینه ۱',
          items: [item('b1-egg', ['تخم‌مرغ', 'egg'], 2, 'egg', 150)],
        },
        {
          key: 'b2',
          position: 1,
          label: 'گزینه ۲',
          items: [item('b2-oats', ['جو دوسر', 'oats'], 40, 'g', 150)],
        },
      ],
    },
    {
      key: 'lunch',
      weekday: 7,
      position: 1,
      originalName: 'ناهار',
      englishLabel: 'Lunch',
      timeStart: null,
      timeEnd: null,
      sourceExcerpt: '',
      reviewed: true,
      options: [
        {
          key: 'l1',
          position: 0,
          label: null,
          items: [item('l1-rice', ['برنج', 'rice'], 150, 'g', 195)],
        },
      ],
    },
  ];
}

async function confirmManualPlan(userId: string) {
  await startManual(userId, 'SAME_EVERY_DAY', 'برنامه من');
  const draft = await updateDraft(userId, 'slots', manualSlots(), 0);
  await confirmPlan(userId, draft.draftRevision);
  const plan = (await getActivePlan(userId))!;
  const breakfast = plan.slots.find((s) => s.englishLabel === 'Breakfast')!;
  const lunch = plan.slots.find((s) => s.englishLabel === 'Lunch')!;
  return { plan, breakfast, lunch };
}

async function logMeal(
  userId: string,
  date: string,
  slotId: string | null,
  optionId: string | null,
) {
  const day = await prisma.dayRecord.upsert({
    where: { userId_localDate: { userId, localDate: date } },
    create: { userId, localDate: date, timeZone: APP_TIME_ZONE },
    update: {},
  });
  return prisma.meal.create({
    data: {
      userId,
      dayRecordId: day.id,
      inputKind: 'PLANNED',
      clientRequestId: `${userId}-${date}-${slotId}-${optionId}-${Math.random()}`,
      planSlotId: slotId,
      planOptionId: optionId,
      linkConfirmedByUser: true,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('confirmPlan (edit)', () => {
  it('keeps row ids and meal links when a quantity is corrected; reports the affected count', async () => {
    const user = await createTestUser();
    const { breakfast, lunch } = await confirmManualPlan(user.id);
    const meals = [
      await logMeal(user.id, '2026-09-13', lunch.id, lunch.options[0]!.id),
      await logMeal(user.id, '2026-09-14', lunch.id, lunch.options[0]!.id),
      await logMeal(user.id, '2026-09-15', lunch.id, lunch.options[0]!.id),
      await logMeal(user.id, '2026-09-15', breakfast.id, breakfast.options[0]!.id),
    ];

    const draft = await startEdit(user.id);
    const lunchDraft = draft.slots.find((s) => s.id === lunch.id)!;
    lunchDraft.options[0]!.items[0]!.quantity = 200;
    const edited = await updateDraft(user.id, 'slot', lunchDraft, draft.draftRevision);

    expect(await countAffectedMeals(user.id, edited)).toBe(3);
    const result = await confirmPlan(user.id, edited.draftRevision);
    expect(result.affectedMeals).toBe(3);

    const after = (await getActivePlan(user.id))!;
    expect(after.slots.map((s) => s.id).sort()).toEqual([breakfast.id, lunch.id].sort());
    const lunchAfter = after.slots.find((s) => s.id === lunch.id)!;
    expect(lunchAfter.options[0]!.id).toBe(lunch.options[0]!.id);
    expect(lunchAfter.options[0]!.items[0]).toMatchObject({
      id: lunch.options[0]!.items[0]!.id,
      quantity: 200,
    });
    const links = await prisma.meal.findMany({
      where: { id: { in: meals.map((m) => m.id) } },
      select: { planSlotId: true, planOptionId: true },
    });
    expect(links.every((l) => l.planSlotId !== null && l.planOptionId !== null)).toBe(true);
    expect(after.draft).toBeNull();
    expect(after.status).toBe('ACTIVE');
  });

  it('a removed option sets the link option to null; a reordered option leaves the link unchanged', async () => {
    const user = await createTestUser();
    const { breakfast } = await confirmManualPlan(user.id);
    const [opt1, opt2] = breakfast.options;
    const mealOpt2 = await logMeal(user.id, '2026-09-14', breakfast.id, opt2!.id);
    const mealOpt1 = await logMeal(user.id, '2026-09-15', breakfast.id, opt1!.id);

    // Reorder: option 2 first.
    let draft = await startEdit(user.id);
    let b = draft.slots.find((s) => s.id === breakfast.id)!;
    b.options.reverse();
    draft = await updateDraft(user.id, 'slot', b, draft.draftRevision);
    expect(await countAffectedMeals(user.id, draft)).toBe(0);
    await confirmPlan(user.id, draft.draftRevision);
    let plan = (await getActivePlan(user.id))!;
    let bAfter = plan.slots.find((s) => s.id === breakfast.id)!;
    expect(bAfter.options.map((o) => o.id)).toEqual([opt2!.id, opt1!.id]);
    expect((await prisma.meal.findUniqueOrThrow({ where: { id: mealOpt1.id } })).planOptionId).toBe(
      opt1!.id,
    );

    // Remove option 1 (the second one now).
    draft = await startEdit(user.id);
    b = draft.slots.find((s) => s.id === breakfast.id)!;
    b.options = b.options.filter((o) => o.id !== opt1!.id);
    draft = await updateDraft(user.id, 'slot', b, draft.draftRevision);
    expect(await countAffectedMeals(user.id, draft)).toBe(1);
    await confirmPlan(user.id, draft.draftRevision);
    plan = (await getActivePlan(user.id))!;
    bAfter = plan.slots.find((s) => s.id === breakfast.id)!;
    expect(bAfter.options.map((o) => o.id)).toEqual([opt2!.id]);
    const links = await prisma.meal.findMany({
      where: { id: { in: [mealOpt1.id, mealOpt2.id] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(links.find((l) => l.id === mealOpt1.id)).toMatchObject({
      planSlotId: breakfast.id,
      planOptionId: null,
    });
    expect(links.find((l) => l.id === mealOpt2.id)).toMatchObject({
      planSlotId: breakfast.id,
      planOptionId: opt2!.id,
    });
  });

  it('a removed slot turns its meals into "Other" and deletes its skipped rows', async () => {
    const user = await createTestUser();
    const { breakfast, lunch } = await confirmManualPlan(user.id);
    const meal = await logMeal(user.id, '2026-09-14', lunch.id, lunch.options[0]!.id);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: '2026-09-13', timeZone: APP_TIME_ZONE },
    });
    await prisma.daySkippedSlot.create({ data: { dayRecordId: day.id, planSlotId: lunch.id } });

    let draft = await startEdit(user.id);
    draft = await updateDraft(
      user.id,
      'slots',
      draft.slots.filter((s) => s.id !== lunch.id),
      draft.draftRevision,
    );
    const { affectedMeals } = await confirmPlan(user.id, draft.draftRevision);
    expect(affectedMeals).toBe(1);

    const plan = (await getActivePlan(user.id))!;
    expect(plan.slots.map((s) => s.id)).toEqual([breakfast.id]);
    expect(await prisma.meal.findUniqueOrThrow({ where: { id: meal.id } })).toMatchObject({
      planSlotId: null,
      planOptionId: null,
    });
    expect(await prisma.daySkippedSlot.count({ where: { dayRecordId: day.id } })).toBe(0);
  });

  it('seeds Profile.weekStart from the first listed weekday, then leaves it alone', async () => {
    const user = await createTestUser();
    expect(user.profile?.weekStart).toBeNull();
    await startManual(user.id, 'BY_WEEKDAY', null);
    const slots = manualSlots().map((s, i) => ({ ...s, weekday: i === 0 ? 3 : 4 }));
    const draft = await updateDraft(user.id, 'slots', slots, 0);
    await confirmPlan(user.id, draft.draftRevision);
    expect((await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } })).weekStart).toBe(
      3,
    );
  });
});

describe('import draft finalize', () => {
  it('a job whose draftId the user has since replaced affects zero rows', async () => {
    const user = await createTestUser();
    const first = await startImport(user.id, 'برنامه اول');
    const second = await startImport(user.id, 'برنامه دوم');
    // Claim the first job by hand, as the runner would.
    await prisma.planImportJob.update({
      where: { id: first.jobId },
      data: { status: 'RUNNING', attempt: 1, heartbeatAt: new Date() },
    });
    const stale: ClaimedJob = {
      id: first.jobId,
      attempt: 1,
      draftId: first.draftId,
      userId: user.id,
    };
    const written = await finalizeJob(stale, {
      draftRevision: 0,
      structure: 'TARGETS_ONLY',
      name: 'stale',
      sourceNote: null,
      sourceLanguage: null,
      slots: [],
      targets: [],
      rules: [],
      notes: [],
      questions: [],
      reviewed: { meals: false, targets: false, rules: false },
      manualStep: null,
    });
    expect(written).toBe(false);
    const plan = await prisma.plan.findUniqueOrThrow({ where: { userId: user.id } });
    expect(plan.draftId).toBe(second.draftId);
    expect(plan.draftJson).toBeNull();
    // The stale attempt ends CANCELLED rather than DONE: nothing of it was committed.
    expect(
      await prisma.planImportJob.findUniqueOrThrow({ where: { id: first.jobId } }),
    ).toMatchObject({
      status: 'CANCELLED',
      errorCategory: 'DRAFT_REPLACED',
    });
  });
});
