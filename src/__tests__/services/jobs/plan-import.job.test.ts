import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { profileFactory } from '@/__tests__/factories';
import type { PlanImportOutput } from '@/services/ai/schemas';

vi.mock('@/services/ai/interpret-plan', () => ({
  interpretPlan: vi.fn(),
  estimatePlanBaseline: vi.fn(),
}));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call-1' })),
  finishOperation: vi.fn(async () => {}),
}));

import { estimatePlanBaseline, interpretPlan } from '@/services/ai/interpret-plan';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import {
  claimNextJob,
  draftFromImport,
  finalizeJob,
  runPlanImportJobs,
  type ClaimedJob,
} from '@/services/jobs/plan-import.job';

resetPrismaMock();
beforeEach(() => vi.clearAllMocks());

const ctx = { shouldStop: () => false, now: new Date('2026-09-16T08:00:00Z') };
const job: ClaimedJob = { id: 'job-1', attempt: 1, draftId: 'draft-1', userId: 'user-1' };

const nutrition = (kcal: number) => ({
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

/** Reference menu plan, trimmed: two slots with per-meal ranges, one option with items lacking nutrition. */
const output: PlanImportOutput = {
  structure: 'SAME_EVERY_DAY',
  name: 'برنامه منو',
  sourceLanguage: 'fa',
  slots: [
    {
      originalName: 'صبحانه',
      englishLabel: 'Breakfast',
      weekday: 7,
      timeStart: null,
      timeEnd: null,
      sourceExcerpt: 'صبحانه (۳۵۰ تا ۴۰۰ کالری)',
      options: [
        {
          label: 'گزینه ۱',
          items: [
            {
              originalName: 'تخم‌مرغ',
              englishLabel: 'egg',
              quantity: 2,
              unit: 'piece',
              unitGrams: 50,
              quantityAssumed: false,
              assumedDefaultKey: null,
              preparationNote: null,
              alternatives: [],
              category: 'MEAT',
              nutrition: nutrition(150),
              sourceExcerpt: '۲ عدد تخم‌مرغ',
            },
            {
              originalName: 'نان سنگک',
              englishLabel: 'sangak bread',
              quantity: null,
              unit: null,
              unitGrams: null,
              quantityAssumed: false,
              assumedDefaultKey: null,
              preparationNote: null,
              alternatives: [],
              category: 'BREAD',
              nutrition: null,
              sourceExcerpt: 'نان سنگک',
            },
          ],
        },
        { label: 'گزینه ۲', items: [] },
      ],
    },
    {
      originalName: 'ناهار',
      englishLabel: 'Lunch',
      weekday: 7,
      timeStart: null,
      timeEnd: null,
      sourceExcerpt: '',
      options: [{ label: null, items: [] }],
    },
  ],
  targets: [
    {
      slotIndex: 0,
      weekday: null,
      nutrient: 'ENERGY_KCAL',
      type: 'RANGE',
      low: 350,
      high: 400,
      sourceExcerpt: null,
    },
    {
      slotIndex: 1,
      weekday: null,
      nutrient: 'ENERGY_KCAL',
      type: 'RANGE',
      low: 600,
      high: 700,
      sourceExcerpt: null,
    },
    {
      slotIndex: 9,
      weekday: null,
      nutrient: 'PROTEIN_G',
      type: 'MINIMUM',
      low: 90,
      high: null,
      sourceExcerpt: null,
    },
  ],
  notes: [
    { originalText: 'روزهای تمرین یک وعده اضافه', reason: 'TRAINING_CONDITIONAL' },
    { originalText: 'هفته‌ای دو بار ماهی', reason: 'OTHER' },
  ],
  uncertainties: [
    { slotIndex: 0, optionIndex: 0, itemIndex: 1, question: 'How much sangak bread?' },
  ],
};

describe('draftFromImport', () => {
  it('assigns keys, maps slot indexes to keys, builds questions and derived targets', () => {
    const draft = draftFromImport(output);
    expect(draft.draftRevision).toBe(0);
    expect(draft.slots).toHaveLength(2);
    const breakfast = draft.slots[0]!;
    expect(breakfast.key).toBeTruthy();
    expect(breakfast.id).toBeUndefined();
    expect(breakfast.options[0]?.items[1]?.key).toBeTruthy();

    const slotTargets = draft.targets.filter((t) => t.source === 'EXPLICIT');
    expect(slotTargets.map((t) => t.slotKey)).toEqual([breakfast.key, draft.slots[1]!.key]);
    // The target pointing past the slots is dropped.
    expect(draft.targets.some((t) => t.nutrient === 'PROTEIN_G')).toBe(false);

    expect(draft.targets.find((t) => t.source === 'SUM_OF_MEALS')).toMatchObject({
      low: 950,
      high: 1100,
    });
    expect(draft.targets.find((t) => t.source === 'ESTIMATED')).toMatchObject({ low: 150 });

    expect(draft.questions).toEqual([
      expect.objectContaining({
        slotKey: breakfast.key,
        itemKey: breakfast.options[0]!.items[1]!.key,
        answered: false,
      }),
    ]);
    // Notes are kept verbatim with a key each; nothing is tracked (decision 023).
    expect(draft.notes.map((n) => [n.originalText, n.reason])).toEqual([
      ['روزهای تمرین یک وعده اضافه', 'TRAINING_CONDITIONAL'],
      ['هفته‌ای دو بار ماهی', 'OTHER'],
    ]);
    expect(draft.notes.every((n) => n.key)).toBe(true);
    expect(draft.reviewed).toEqual({ meals: false, targets: false, notes: false });
  });
});

describe('claimNextJob / finalizeJob', () => {
  it('claims through the atomic UPDATE and returns null when nothing is claimable', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([job]);
    expect(await claimNextJob()).toEqual(job);
    const strings = prismaMock.$queryRaw.mock.calls[0]?.[0] as unknown as string[];
    const text = strings.join('?');
    expect(text).toContain('FOR UPDATE SKIP LOCKED');
    expect(text).toContain("status IN ('QUEUED', 'RUNNING')");
    expect(text).toContain('RETURNING id, attempt, "draftId", "userId"');
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    expect(await claimNextJob()).toBeNull();
  });

  it('writes the draft only when the job row was still this RUNNING attempt', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => unknown)(prismaMock),
    );
    prismaMock.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    expect(await finalizeJob(job, draftFromImport(output))).toBe(true);
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => unknown)(prismaMock),
    );
    prismaMock.$executeRaw.mockResolvedValueOnce(0);
    expect(await finalizeJob(job, draftFromImport(output))).toBe(false);
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('runPlanImportJobs', () => {
  function arrangeClaim(...jobs: ClaimedJob[]) {
    for (const j of jobs) prismaMock.$queryRaw.mockResolvedValueOnce([j]);
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    prismaMock.plan.findFirst.mockResolvedValue({
      draftSourceText: 'صبحانه: ۲ عدد تخم‌مرغ',
      user: { profile: profileFactory.build() },
    } as never);
    prismaMock.planImportJob.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => unknown)(prismaMock),
    );
    prismaMock.$executeRaw.mockResolvedValue(1);
  }

  it('interprets, estimates the missing items, records the operation and finalizes', async () => {
    arrangeClaim(job);
    vi.mocked(interpretPlan).mockResolvedValue({
      ok: true,
      data: output,
      attempts: [{ model: 'm', durationMs: 5, outcome: 'OK' }],
      usage: { promptTokens: 10, completionTokens: 20 },
      model: 'm',
      durationMs: 5,
    });
    vi.mocked(estimatePlanBaseline).mockResolvedValue({
      ok: true,
      data: { items: [{ index: 0, nutrition: nutrition(210), unitGrams: null }] },
      attempts: [{ model: 'm', durationMs: 3, outcome: 'OK' }],
      usage: { promptTokens: 1, completionTokens: 2 },
      model: 'm',
      durationMs: 3,
    });

    await runPlanImportJobs(ctx);

    expect(admitOperation).toHaveBeenCalledWith('user-1', 'PLAN_IMPORT', '2026-09-16', ctx.now, {
      retryOfAdmitted: false,
    });
    expect(vi.mocked(interpretPlan).mock.calls[0]?.[0]).toMatchObject({
      sourceText: 'صبحانه: ۲ عدد تخم‌مرغ',
      profile: { ageYears: 30, sex: 'FEMALE', heightCm: 168, weightKg: 64 },
    });
    expect(vi.mocked(interpretPlan).mock.calls[0]?.[0].userTag).not.toContain('user-1');
    expect(
      vi.mocked(estimatePlanBaseline).mock.calls[0]?.[0].items.map((i) => i.englishLabel),
    ).toEqual(['sangak bread']);
    expect(finishOperation).toHaveBeenCalledWith(
      'call-1',
      expect.objectContaining({ ok: true, usage: { promptTokens: 11, completionTokens: 22 } }),
    );
    // Finalize: job DONE, then the draft written with the estimated item and the recomputed baseline.
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
    const written = JSON.parse(prismaMock.$executeRaw.mock.calls[1]?.[1] as string);
    expect(written.slots[0].options[0].items[1].nutrition.values.ENERGY_KCAL).toBe(210);
    expect(written.targets.find((t: { source: string }) => t.source === 'ESTIMATED').low).toBe(360);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('a failed attempt is queued again, the third one is FAILED with the reason', async () => {
    arrangeClaim(job);
    vi.mocked(interpretPlan).mockResolvedValue({
      ok: false,
      reason: 'TIMEOUT',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 1,
    });
    await runPlanImportJobs(ctx);
    expect(prismaMock.planImportJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', attempt: 1, status: 'RUNNING' },
      data: { status: 'QUEUED', errorCategory: 'TIMEOUT' },
    });

    vi.clearAllMocks();
    arrangeClaim({ ...job, attempt: 3 });
    await runPlanImportJobs(ctx);
    expect(prismaMock.planImportJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', attempt: 3, status: 'RUNNING' },
      data: expect.objectContaining({ status: 'FAILED', errorCategory: 'TIMEOUT' }),
    });
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("a retry attempt reuses the job's admission instead of spending another", async () => {
    arrangeClaim({ ...job, attempt: 2 });
    vi.mocked(interpretPlan).mockResolvedValue({
      ok: false,
      reason: 'PROVIDER_ERROR',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 1,
    });
    await runPlanImportJobs(ctx);
    expect(admitOperation).toHaveBeenCalledWith('user-1', 'PLAN_IMPORT', '2026-09-16', ctx.now, {
      retryOfAdmitted: true,
    });
    expect(finishOperation).toHaveBeenCalledWith('call-1', expect.objectContaining({ ok: false }));
  });

  it('a refused admission fails the job with the cap code and calls no provider', async () => {
    arrangeClaim(job);
    vi.mocked(admitOperation).mockResolvedValueOnce({ ok: false, code: 'DAILY_AI_CAP' });
    await runPlanImportJobs(ctx);
    expect(interpretPlan).not.toHaveBeenCalled();
    expect(prismaMock.planImportJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', attempt: 1, status: 'RUNNING' },
      data: expect.objectContaining({ status: 'FAILED', errorCategory: 'DAILY_AI_CAP' }),
    });
  });

  it('a job whose draft was replaced is cancelled without an AI call', async () => {
    arrangeClaim(job);
    prismaMock.plan.findFirst.mockResolvedValue(null);
    await runPlanImportJobs(ctx);
    expect(admitOperation).not.toHaveBeenCalled();
    expect(prismaMock.planImportJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', attempt: 1, status: 'RUNNING' },
      data: expect.objectContaining({ status: 'CANCELLED', errorCategory: 'DRAFT_REPLACED' }),
    });
  });

  it('stops claiming when the scheduler asks to', async () => {
    await runPlanImportJobs({ ...ctx, shouldStop: () => true });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
