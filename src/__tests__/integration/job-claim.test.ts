import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestUser, resetDatabase } from '@/__tests__/integration/db';
import type { PlanImportOutput } from '@/services/ai/schemas';

vi.mock('@/services/ai/interpret-plan', () => ({
  interpretPlan: vi.fn(),
  estimatePlanBaseline: vi.fn(),
}));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call-1' })),
  finishOperation: vi.fn(async () => {}),
}));

import { interpretPlan } from '@/services/ai/interpret-plan';
import {
  claimNextJob,
  draftFromImport,
  finalizeJob,
  runPlanImportJobs,
} from '@/services/jobs/plan-import.job';
import { renewLease, stopScheduler } from '@/services/jobs/scheduler';
import { getImportStatus, getPlan, startImport } from '@/services/plan.service';

/** Tech spec § 21.7: claims are atomic, a stale RUNNING job is reclaimed, the obsolete attempt cannot commit. */

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
      sourceExcerpt: '',
      options: [
        {
          label: null,
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
              nutrition: {
                basis: 'PER_RECORDED_PORTION',
                basisQuantity: null,
                basisUnit: null,
                values: {
                  ENERGY_KCAL: 150,
                  PROTEIN_G: 12,
                  CARB_G: 1,
                  FAT_G: 10,
                  FIBER_G: null,
                  SODIUM_MG: null,
                },
                source: 'AI_ESTIMATE',
                sourceRef: null,
                isEstimate: true,
                userOverride: false,
              },
              sourceExcerpt: '',
            },
          ],
        },
      ],
    },
  ],
  targets: [],
  notes: [],
  uncertainties: [],
};

const okResult = {
  ok: true as const,
  data: output,
  attempts: [],
  usage: { promptTokens: 1, completionTokens: 1 },
  model: 'stub',
  durationMs: 1,
};

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  stopScheduler();
});

describe('claimNextJob', () => {
  it('two concurrent claims take different jobs; a third finds nothing', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await startImport(a.id, 'برنامه الف');
    await startImport(b.id, 'برنامه ب');

    const [first, second, third] = await Promise.all([
      claimNextJob(),
      claimNextJob(),
      claimNextJob(),
    ]);
    const claimed = [first, second, third].filter((j) => j !== null);
    expect(claimed).toHaveLength(2);
    expect(new Set(claimed.map((j) => j!.id)).size).toBe(2);
    expect(claimed.every((j) => j!.attempt === 1)).toBe(true);
    const rows = await prisma.planImportJob.findMany();
    expect(rows.every((r) => r.status === 'RUNNING' && r.heartbeatAt !== null)).toBe(true);
  });

  it('a RUNNING job with a 4-minute-old heartbeat is reclaimed and the obsolete attempt cannot finalize', async () => {
    const user = await createTestUser();
    const { jobId } = await startImport(user.id, 'برنامه');
    const stale = (await claimNextJob())!;
    expect(stale).toMatchObject({ id: jobId, attempt: 1 });

    // Nothing to reclaim while the heartbeat is fresh.
    expect(await claimNextJob()).toBeNull();

    await prisma.planImportJob.update({
      where: { id: jobId },
      data: { heartbeatAt: new Date(Date.now() - 4 * 60_000) },
    });
    const reclaimed = (await claimNextJob())!;
    expect(reclaimed).toMatchObject({ id: jobId, attempt: 2 });

    // The reclaimed attempt completes once...
    const draft = draftFromImport(output);
    expect(await finalizeJob(reclaimed, draft)).toBe(true);
    // ...and the obsolete attempt's finalize affects zero rows.
    expect(await finalizeJob(stale, { ...draft, name: 'obsolete' })).toBe(false);

    const plan = await getPlan(user.id);
    expect(plan?.draft).toEqual({ kind: 'IMPORT', state: 'READY' });
    expect(plan?.draftJson?.name).toBe('برنامه منو');
    expect((await prisma.planImportJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      'DONE',
    );
  });
});

describe('runPlanImportJobs end to end', () => {
  it('runs the queued job through the mocked AI and makes the draft READY', async () => {
    const user = await createTestUser();
    vi.mocked(interpretPlan).mockResolvedValue(okResult);
    await startImport(user.id, 'صبحانه: ۲ عدد تخم‌مرغ');
    expect(await getImportStatus(user.id)).toEqual({ state: 'PENDING', errorCategory: null });

    await runPlanImportJobs({ shouldStop: () => false, now: new Date() });

    expect(interpretPlan).toHaveBeenCalledTimes(1);
    expect(await getImportStatus(user.id)).toEqual({ state: 'READY', errorCategory: null });
    const plan = await getPlan(user.id);
    expect(plan?.draftJson?.slots[0]?.options[0]?.items[0]?.englishLabel).toBe('egg');
    expect(plan?.draftJson?.targets.find((t) => t.source === 'ESTIMATED')).toMatchObject({
      low: 150,
    });
  });

  it('three failed attempts end FAILED with the category; the status reports it', async () => {
    const user = await createTestUser();
    vi.mocked(interpretPlan).mockResolvedValue({
      ok: false,
      reason: 'TIMEOUT',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 1,
    });
    await startImport(user.id, 'x');
    for (let i = 0; i < 3; i += 1)
      await runPlanImportJobs({ shouldStop: () => false, now: new Date() });
    expect(interpretPlan).toHaveBeenCalledTimes(3);
    expect(await getImportStatus(user.id)).toEqual({ state: 'FAILED', errorCategory: 'TIMEOUT' });
    expect(await claimNextJob()).toBeNull();
  });
});

describe('scheduler lease', () => {
  it('is won by this process and renewed while it holds it', async () => {
    await prisma.$executeRaw`
      INSERT INTO job_locks (id, name, holder, "lockedUntil", "updatedAt")
      VALUES ('lock-1', 'scheduler', 'other-process', now() + interval '30 seconds', now())`;
    // Another holder still owns it.
    expect(await renewLease()).toBe(false);
    await prisma.jobLock.update({
      where: { name: 'scheduler' },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(await renewLease()).toBe(true);
    expect(await renewLease()).toBe(true);
    const row = await prisma.jobLock.findUniqueOrThrow({ where: { name: 'scheduler' } });
    expect(row.holder).not.toBe('other-process');
    expect(row.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 50_000);
  });
});
