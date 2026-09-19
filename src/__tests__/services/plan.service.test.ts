import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { buildPlanWithRows, planFactory, planImportJobFactory } from '@/__tests__/factories';
import { PLAN_TEXT_MAX, type PlanDraft } from '@/lib/validations/plan';

vi.mock('@/services/ai/interpret-plan', () => ({
  interpretPlan: vi.fn(),
  estimatePlanBaseline: vi.fn(),
}));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call-1' })),
  finishOperation: vi.fn(async () => {}),
}));
vi.mock('@/services/reflection.service', () => ({ markStaleIfNeeded: vi.fn(async () => {}) }));

import { estimatePlanBaseline } from '@/services/ai/interpret-plan';
import { admitOperation } from '@/services/ai-usage.service';
import { markStaleIfNeeded } from '@/services/reflection.service';
import {
  confirmPlan,
  countAffectedMeals,
  deletePlan,
  draftFromRows,
  estimateDraftBaseline,
  getActivePlan,
  getImportStatus,
  recomputeDerivedTargets,
  slotsForWeekday,
  startEdit,
  startImport,
  startManual,
  updateDraft,
} from '@/services/plan.service';

resetPrismaMock();
beforeEach(() => vi.clearAllMocks());

const nutrition = (kcal: number | null) => ({
  basis: 'PER_RECORDED_PORTION' as const,
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
  source: 'AI_ESTIMATE' as const,
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
});

/** A parsed edit draft of the factory plan (ids copied). */
function editDraft(): PlanDraft {
  return draftFromRows(buildPlanWithRows());
}

/** Installs an interactive `$transaction` that hands the mock client to the callback. */
function interactiveTransaction() {
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg as Promise<unknown>[]),
  );
}

describe('read model', () => {
  it('maps rows to rubric slots with numbers and parsed nutrition', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(buildPlanWithRows() as never);
    const plan = await getActivePlan('user-1');
    expect(plan?.slots).toHaveLength(2);
    expect(plan?.slots[0]?.options[0]?.items[0]).toMatchObject({
      id: 'item-b1a',
      quantity: 150,
      nutrition: expect.objectContaining({ basis: 'PER_RECORDED_PORTION' }),
    });
    expect(plan?.targets[0]).toMatchObject({ id: 'target-1', low: 2200, high: null });
    expect(plan?.draft).toBeNull();
  });

  it('returns null when the plan is NONE', async () => {
    prismaMock.plan.findUnique.mockResolvedValue({
      ...buildPlanWithRows({ status: 'NONE' }),
      slots: [],
    } as never);
    expect(await getActivePlan('user-1')).toBeNull();
  });

  it('reports the import as PENDING while the job runs and FAILED afterwards', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({ draftKind: 'IMPORT', draftId: 'd1', draftJson: null }) as never,
    );
    prismaMock.planImportJob.findFirst.mockResolvedValueOnce(
      planImportJobFactory.build({ status: 'RUNNING' }),
    );
    expect(await getImportStatus('user-1')).toEqual({ state: 'PENDING', errorCategory: null });
    prismaMock.planImportJob.findFirst.mockResolvedValueOnce(
      planImportJobFactory.build({ status: 'FAILED', errorCategory: 'TIMEOUT' }),
    );
    expect(await getImportStatus('user-1')).toEqual({ state: 'FAILED', errorCategory: 'TIMEOUT' });
  });

  it('slotsForWeekday keeps every-day slots and that weekday only', () => {
    const slots = [
      { id: 'a', weekday: 7, position: 1 },
      { id: 'b', weekday: 6, position: 0 },
      { id: 'c', weekday: 0, position: 0 },
    ] as never;
    expect(slotsForWeekday({ slots }, 6).map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('startImport', () => {
  it('refuses over-limit text with PLAN_TEXT_TOO_LONG', async () => {
    await expect(startImport('user-1', 'x'.repeat(PLAN_TEXT_MAX + 1))).rejects.toMatchObject({
      code: 'PLAN_TEXT_TOO_LONG',
    });
    expect(prismaMock.plan.upsert).not.toHaveBeenCalled();
  });

  it('writes draftSourceText, a fresh draftId and a QUEUED job; cancels older queued jobs', async () => {
    prismaMock.planImportJob.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.plan.upsert.mockResolvedValue(planFactory.build());
    prismaMock.planImportJob.create.mockResolvedValue({ id: 'job-9' } as never);
    const result = await startImport('user-1', 'صبحانه: تخم‌مرغ');
    expect(result.jobId).toBe('job-9');
    const upsert = prismaMock.plan.upsert.mock.calls[0]?.[0];
    expect(upsert?.update).toMatchObject({
      status: 'DRAFT_PENDING',
      draftKind: 'IMPORT',
      draftSourceText: 'صبحانه: تخم‌مرغ',
      draftId: result.draftId,
    });
    expect(prismaMock.planImportJob.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      userId: 'user-1',
      status: { in: ['QUEUED'] },
    });
    expect(prismaMock.planImportJob.create.mock.calls[0]?.[0].data).toMatchObject({
      userId: 'user-1',
      draftId: result.draftId,
      status: 'QUEUED',
    });
  });
});

describe('startManual / startEdit', () => {
  it('startManual writes an empty draft at revision 0', async () => {
    prismaMock.planImportJob.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.plan.upsert.mockResolvedValue(planFactory.build());
    const draft = await startManual('user-1', 'TARGETS_ONLY', 'My plan');
    expect(draft).toMatchObject({
      draftRevision: 0,
      structure: 'TARGETS_ONLY',
      name: 'My plan',
      slots: [],
    });
    expect(prismaMock.plan.upsert.mock.calls[0]?.[0].update).toMatchObject({ draftKind: 'MANUAL' });
  });

  it('startEdit copies the rows with their ids into draftJson', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(buildPlanWithRows() as never);
    prismaMock.planImportJob.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.plan.update.mockResolvedValue(planFactory.build());
    const draft = await startEdit('user-1');
    expect(draft.slots.map((s) => s.id)).toEqual(['slot-b', 'slot-l']);
    expect(draft.slots[0]?.options.map((o) => o.id)).toEqual(['opt-b1', 'opt-b2']);
    expect(draft.slots[0]?.options[0]?.items[0]).toMatchObject({ id: 'item-b1a', quantity: 150 });
    expect(draft.targets[0]?.slotKey).toBeNull();
    expect(prismaMock.plan.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'DRAFT_PENDING',
      draftKind: 'EDIT',
    });
  });

  it('startEdit refuses when nothing was confirmed', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(buildPlanWithRows({ confirmedAt: null }) as never);
    await expect(startEdit('user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('updateDraft', () => {
  it('rejects a stale revision with CONFLICT', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({
        draftKind: 'EDIT',
        draftJson: { ...editDraft(), draftRevision: 3 } as never,
      }) as never,
    );
    await expect(updateDraft('user-1', 'meta', { name: 'x' }, 2)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.plan.updateMany).not.toHaveBeenCalled();
  });

  it('writes conditionally on the stored draft and revision, CONFLICT when the row moved on', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({
        draftKind: 'EDIT',
        draftId: 'draft-7',
        draftJson: editDraft() as never,
      }) as never,
    );
    // Another edit from the same revision landed between the read and the write.
    prismaMock.plan.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateDraft('user-1', 'meta', { name: 'x' }, 0)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.plan.updateMany.mock.calls[0]?.[0].where).toEqual({
      userId: 'user-1',
      draftId: 'draft-7',
      draftJson: { path: ['draftRevision'], equals: 0 },
    });
  });

  it('replaces one slot by key, flags changed items and bumps the revision', async () => {
    const draft = editDraft();
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({ draftKind: 'EDIT', draftJson: draft as never }) as never,
    );
    prismaMock.plan.updateMany.mockResolvedValue({ count: 1 });
    const lunch = draft.slots[1]!;
    const edited = {
      ...lunch,
      options: [
        {
          ...lunch.options[0]!,
          items: lunch.options[0]!.items.map((item, i) =>
            i === 0 ? { ...item, quantity: 200 } : item,
          ),
        },
      ],
    };
    const next = await updateDraft('user-1', 'slot', edited, 0);
    expect(next.draftRevision).toBe(1);
    expect(next.slots[1]?.options[0]?.items.map((i) => i.needsEstimate)).toEqual([true, false]);
    expect(prismaMock.plan.updateMany.mock.calls[0]?.[0].data.draftJson).toMatchObject({
      draftRevision: 1,
    });
  });
});

describe('recomputeDerivedTargets', () => {
  const slot = (key: string, kcals: Array<number | null>, weekday = 7) => ({
    key,
    weekday,
    position: 0,
    originalName: key,
    englishLabel: key,
    timeStart: null,
    timeEnd: null,
    sourceExcerpt: '',
    reviewed: false,
    options: [
      {
        key: `${key}-o`,
        position: 0,
        label: null,
        items: kcals.map((kcal, i) => ({
          key: `${key}-i${i}`,
          position: i,
          originalName: 'x',
          englishLabel: 'x',
          quantity: null,
          unit: null,
          quantityAssumed: false,
          assumedDefaultKey: null,
          preparationNote: null,
          alternatives: [],
          category: 'OTHER' as const,
          nutrition: kcal === null ? null : nutrition(kcal),
          sourceExcerpt: '',
          needsEstimate: false,
        })),
      },
    ],
  });
  const explicitRange = (slotKey: string | null, low: number, high: number) => ({
    key: `t-${slotKey}`,
    slotKey,
    weekday: null,
    nutrient: 'ENERGY_KCAL' as const,
    type: 'RANGE' as const,
    low,
    high,
    source: 'EXPLICIT' as const,
    sourceExcerpt: null,
  });

  it('sums the first option of each slot into an ESTIMATED daily target', () => {
    const targets = recomputeDerivedTargets({
      structure: 'SAME_EVERY_DAY',
      slots: [slot('a', [150, 210]), slot('b', [195, null])],
      targets: [],
    });
    expect(targets).toEqual([
      expect.objectContaining({
        source: 'ESTIMATED',
        nutrient: 'ENERGY_KCAL',
        low: 555,
        type: 'APPROXIMATE',
      }),
    ]);
  });

  it('never overrides an explicit daily figure and adds SUM_OF_MEALS only when every slot has a range', () => {
    const withExplicit = recomputeDerivedTargets({
      structure: 'SAME_EVERY_DAY',
      slots: [slot('a', [150])],
      targets: [explicitRange(null, 1800, 2000)],
    });
    expect(withExplicit.filter((t) => t.nutrient === 'ENERGY_KCAL')).toHaveLength(1);

    const partial = recomputeDerivedTargets({
      structure: 'SAME_EVERY_DAY',
      slots: [slot('a', [150]), slot('b', [200])],
      targets: [explicitRange('a', 300, 400)],
    });
    expect(partial.some((t) => t.source === 'SUM_OF_MEALS')).toBe(false);

    const full = recomputeDerivedTargets({
      structure: 'SAME_EVERY_DAY',
      slots: [slot('a', [150]), slot('b', [200])],
      targets: [explicitRange('a', 300, 400), explicitRange('b', 500, 600)],
    });
    expect(full.find((t) => t.source === 'SUM_OF_MEALS')).toMatchObject({
      low: 800,
      high: 1000,
      slotKey: null,
    });
  });

  it('weekday plans get one estimated set per weekday', () => {
    const targets = recomputeDerivedTargets({
      structure: 'BY_WEEKDAY',
      slots: [slot('sat', [100], 6), slot('sun', [300], 0)],
      targets: [],
    });
    expect(targets.map((t) => [t.weekday, t.low])).toEqual([
      [6, 100],
      [0, 300],
    ]);
  });
});

describe('countAffectedMeals', () => {
  it('counts meals whose slot is removed or whose option is removed or changed', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(buildPlanWithRows() as never);
    prismaMock.meal.count.mockResolvedValue(3);
    const draft = editDraft();
    // Remove option 2 of breakfast, drop lunch entirely.
    draft.slots[0]!.options = [draft.slots[0]!.options[0]!];
    draft.slots = [draft.slots[0]!];
    expect(await countAffectedMeals('user-1', draft)).toBe(3);
    const where = prismaMock.meal.count.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.OR).toEqual([
      { planSlotId: { notIn: ['slot-b'] } },
      { planOptionId: { not: null, notIn: ['opt-b1'] } },
    ]);
  });

  it('a reordered option stays kept', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(buildPlanWithRows() as never);
    prismaMock.meal.count.mockResolvedValue(0);
    const draft = editDraft();
    draft.slots[0]!.options.reverse();
    await countAffectedMeals('user-1', draft);
    const where = prismaMock.meal.count.mock.calls[0]?.[0]?.where as {
      OR: Array<{ planOptionId?: { notIn: string[] } }>;
    };
    expect(where.OR[1]?.planOptionId?.notIn.sort()).toEqual(['opt-b1', 'opt-b2', 'opt-l1']);
  });

  it('returns 0 without active rows', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(null);
    expect(await countAffectedMeals('user-1', editDraft())).toBe(0);
    expect(prismaMock.meal.count).not.toHaveBeenCalled();
  });
});

describe('confirmPlan', () => {
  function arrangeConfirm(draft: PlanDraft, kind: 'EDIT' | 'IMPORT' = 'EDIT') {
    const rows = buildPlanWithRows();
    prismaMock.plan.findUnique.mockResolvedValue({
      ...rows,
      draftKind: kind,
      draftJson: draft,
      draftSourceText: kind === 'IMPORT' ? 'متن برنامه' : null,
    } as never);
    prismaMock.plan.findUniqueOrThrow.mockResolvedValue(rows as never);
    prismaMock.meal.count.mockResolvedValue(2);
    interactiveTransaction();
    prismaMock.planSlot.update.mockImplementation(
      (args) => Promise.resolve({ id: args.where.id }) as never,
    );
    prismaMock.planSlot.create.mockResolvedValue({ id: 'slot-new' } as never);
    prismaMock.planOption.update.mockImplementation(
      (args) => Promise.resolve({ id: args.where.id }) as never,
    );
    prismaMock.planOption.create.mockResolvedValue({ id: 'opt-new' } as never);
    prismaMock.profile.findUnique.mockResolvedValue({ timeZone: 'Asia/Tehran' } as never);
  }

  it('rejects a stale draft revision', async () => {
    arrangeConfirm({ ...editDraft(), draftRevision: 4 });
    await expect(confirmPlan('user-1', 3)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('edit: updates rows with ids in place, deletes the absent ones, replaces targets, seeds the week start', async () => {
    const draft = editDraft();
    draft.slots[0]!.options = [draft.slots[0]!.options[0]!]; // option 2 removed
    draft.slots[0]!.options[0]!.items[0]!.quantity = 3; // item edited
    arrangeConfirm(draft);

    const result = await confirmPlan('user-1', 0, new Date('2026-09-16T10:00:00Z'));
    expect(result).toEqual({ affectedMeals: 2 });

    expect(prismaMock.planSlot.deleteMany.mock.calls[0]?.[0]?.where).toEqual({
      planId: 'plan-1',
      id: { notIn: ['slot-b', 'slot-l'] },
    });
    expect(prismaMock.planOption.deleteMany.mock.calls[0]?.[0]?.where).toMatchObject({
      id: { notIn: ['opt-b1', 'opt-l1'] },
    });
    expect(prismaMock.planSlot.create).not.toHaveBeenCalled();
    expect(prismaMock.planItem.create).not.toHaveBeenCalled();
    expect(prismaMock.planItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-b1a' },
        data: expect.objectContaining({ quantity: 3 }),
      }),
    );
    expect(prismaMock.planTarget.deleteMany).toHaveBeenCalledWith({ where: { planId: 'plan-1' } });
    expect(prismaMock.planTarget.createMany.mock.calls[0]?.[0]?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'all:day:ENERGY_KCAL', source: 'EXPLICIT' }),
      ]),
    );
    expect(prismaMock.plan.update.mock.calls.at(-1)?.[0].data).toMatchObject({
      status: 'ACTIVE',
      draftId: null,
      draftKind: null,
      confirmedAt: new Date('2026-09-16T10:00:00Z'),
    });
    expect(prismaMock.profile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', weekStart: null },
      data: { weekStart: 6 },
    });
    expect(markStaleIfNeeded).toHaveBeenCalledWith('user-1', '2026-09-16');
  });

  it('import: inserts every row, replaces the old ones and copies the source text', async () => {
    const draft = editDraft();
    for (const slot of draft.slots) {
      delete slot.id;
      for (const option of slot.options) {
        delete option.id;
        for (const item of option.items) delete item.id;
      }
    }
    arrangeConfirm(draft, 'IMPORT');
    await confirmPlan('user-1', 0);
    expect(prismaMock.planSlot.deleteMany.mock.calls[0]?.[0]?.where).toEqual({
      planId: 'plan-1',
      id: { notIn: [] },
    });
    expect(prismaMock.planSlot.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.planSlot.update).not.toHaveBeenCalled();
    expect(prismaMock.plan.update.mock.calls.at(-1)?.[0].data).toMatchObject({
      sourceText: 'متن برنامه',
      draftSourceText: null,
    });
  });

  it('weekday plans seed the week start from the first listed weekday', async () => {
    const draft = editDraft();
    draft.structure = 'BY_WEEKDAY';
    draft.slots[0]!.weekday = 3;
    draft.slots[1]!.weekday = 4;
    arrangeConfirm(draft);
    await confirmPlan('user-1', 0);
    expect(prismaMock.profile.updateMany.mock.calls[0]?.[0]?.data).toEqual({ weekStart: 3 });
  });
});

describe('estimateDraftBaseline', () => {
  function arrange(draft: PlanDraft) {
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({ draftKind: 'MANUAL', draftJson: draft as never }) as never,
    );
    prismaMock.profile.findUnique.mockResolvedValue({ timeZone: 'Asia/Tehran' } as never);
    prismaMock.plan.updateMany.mockResolvedValue({ count: 1 });
  }

  it('estimates only items without nutrition or flagged, then recomputes the targets', async () => {
    const draft = editDraft();
    draft.targets = [];
    draft.slots[0]!.options[0]!.items[0]!.nutrition = null;
    draft.slots[1]!.options[0]!.items[1]!.needsEstimate = true;
    arrange(draft);
    vi.mocked(estimatePlanBaseline).mockResolvedValue({
      ok: true,
      data: {
        items: [
          { index: 0, nutrition: nutrition(160) },
          { index: 1, nutrition: nutrition(220) },
        ],
      },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 1,
    });
    const next = await estimateDraftBaseline('user-1', 0);
    const sent = vi
      .mocked(estimatePlanBaseline)
      .mock.calls[0]?.[0].items.map((i) => i.englishLabel);
    expect(sent).toEqual(['egg', 'chicken']);
    expect(admitOperation).toHaveBeenCalledWith('user-1', 'PLAN_BASELINE', expect.any(String));
    expect(next.draftRevision).toBe(1);
    expect(next.slots[0]?.options[0]?.items[0]?.nutrition?.values.ENERGY_KCAL).toBe(160);
    expect(next.slots[1]?.options[0]?.items[1]).toMatchObject({ needsEstimate: false });
    // 160 + 210 (breakfast option 1) + 195 + 220 (lunch)
    expect(next.targets.find((t) => t.source === 'ESTIMATED')?.low).toBe(785);
  });

  it('fails with the admission code when the daily cap is reached', async () => {
    const draft = editDraft();
    draft.slots[0]!.options[0]!.items[0]!.nutrition = null;
    arrange(draft);
    vi.mocked(admitOperation).mockResolvedValueOnce({ ok: false, code: 'DAILY_AI_CAP' });
    await expect(estimateDraftBaseline('user-1', 0)).rejects.toMatchObject({
      code: 'DAILY_AI_CAP',
    });
    expect(estimatePlanBaseline).not.toHaveBeenCalled();
  });

  it('skips the AI entirely when nothing needs an estimate', async () => {
    arrange(editDraft());
    const next = await estimateDraftBaseline('user-1', 0);
    expect(admitOperation).not.toHaveBeenCalled();
    expect(next.draftRevision).toBe(1);
  });

  it('refuses the write with CONFLICT when the draft moved on during the call', async () => {
    const draft = editDraft();
    draft.slots[0]!.options[0]!.items[0]!.nutrition = null;
    arrange(draft);
    vi.mocked(estimatePlanBaseline).mockResolvedValue({
      ok: true,
      data: { items: [{ index: 0, nutrition: nutrition(160) }] },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 1,
    });
    prismaMock.plan.updateMany.mockResolvedValue({ count: 0 });
    await expect(estimateDraftBaseline('user-1', 0)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.plan.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      draftJson: { path: ['draftRevision'], equals: 0 },
    });
  });
});

describe('deletePlan', () => {
  it('requires the typed name to match', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(planFactory.build({ name: 'برنامه من' }));
    await expect(deletePlan('user-1', 'wrong')).rejects.toMatchObject({
      code: 'CONFIRMATION_MISMATCH',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('deletes the rows and sets status NONE', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({ id: 'plan-1', name: 'برنامه من' }),
    );
    prismaMock.planImportJob.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockResolvedValue([]);
    await deletePlan('user-1', ' برنامه من ');
    expect(prismaMock.planSlot.deleteMany).toHaveBeenCalledWith({ where: { planId: 'plan-1' } });
    expect(prismaMock.plan.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'NONE',
      confirmedAt: null,
    });
  });
});

describe('updateDraft meta', () => {
  it('changes only the keys that were sent', async () => {
    const draft = { ...editDraft(), sourceNote: 'doctor' };
    prismaMock.plan.findUnique.mockResolvedValue(
      planFactory.build({ draftKind: 'EDIT', draftJson: draft as never }) as never,
    );
    prismaMock.plan.updateMany.mockResolvedValue({ count: 1 });
    const next = await updateDraft('user-1', 'meta', { name: 'new name' }, 0);
    expect(next).toMatchObject({ name: 'new name', sourceNote: 'doctor', draftRevision: 1 });
  });
});
