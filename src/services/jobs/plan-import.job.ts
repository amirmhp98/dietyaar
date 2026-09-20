import { createHash, randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import {
  planDraftSchema,
  type DraftQuestion,
  type DraftSlot,
  type DraftTarget,
  type PlanDraft,
} from '@/lib/validations/plan';
import { estimatePlanBaseline, interpretPlan } from '@/services/ai/interpret-plan';
import type { PlanImportOutput } from '@/services/ai/schemas';
import type { AiResult, BaselineItemInput, ProfileContext } from '@/services/ai/types';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import { registerTask, type JobContext } from '@/services/jobs/registry';
import { recomputeDerivedTargets } from '@/services/plan.service';

/**
 * `plan-import` task (tech spec § 12, implementation plan task 4.1). Jobs are
 * `plan_import_jobs` rows claimed atomically with `FOR UPDATE SKIP LOCKED`,
 * so the scheduler tick and `after(runJobsNow)` from the start action can run
 * side by side. No transaction is held during the AI calls; the finalize is
 * conditional on the attempt, on `status = 'RUNNING'` and on the plan's
 * `draftId` still being the one the job was started for.
 */

export const PLAN_IMPORT_TASK = 'plan-import';
export const MAX_ATTEMPTS = 3;
export const HEARTBEAT_MS = 20_000;
export const IMPORT_DEADLINE_MS = 120_000;
/** A running job whose heartbeat is older than this (the literal in the claim SQL) is reclaimed. */
export const STALE_HEARTBEAT_MS = 3 * 60_000;

export interface ClaimedJob {
  id: string;
  attempt: number;
  draftId: string;
  userId: string;
}

/** Claims the oldest queued (or stale running) job; null when nothing is claimable. */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE plan_import_jobs
    SET status = 'RUNNING', attempt = attempt + 1, "heartbeatAt" = now(), "startedAt" = now(),
        "updatedAt" = now()
    WHERE id = (
      SELECT id FROM plan_import_jobs
      WHERE status = 'QUEUED'
         OR (status = 'RUNNING' AND "heartbeatAt" < now() - interval '3 minutes')
      ORDER BY "createdAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) AND status IN ('QUEUED', 'RUNNING')
    RETURNING id, attempt, "draftId", "userId"`;
  return rows[0] ?? null;
}

async function heartbeat(job: ClaimedJob): Promise<void> {
  await prisma.planImportJob.updateMany({
    where: { id: job.id, attempt: job.attempt, status: 'RUNNING' },
    data: { heartbeatAt: new Date() },
  });
}

/**
 * One transaction: the job row goes to DONE only for this attempt while still
 * RUNNING, and the draft is written only when that succeeded and the plan's
 * `draftId` still matches. Returns whether the draft was written.
 */
export async function finalizeJob(job: ClaimedJob, draft: PlanDraft): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const done = await tx.$executeRaw`
      UPDATE plan_import_jobs
      SET status = 'DONE', "finishedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
      WHERE id = ${job.id} AND attempt = ${job.attempt} AND status = 'RUNNING'`;
    if (done !== 1) return false;
    const written = await tx.$executeRaw`
      UPDATE plans
      SET "draftJson" = ${JSON.stringify(draft)}::jsonb, "updatedAt" = now()
      WHERE "userId" = ${job.userId} AND "draftId" = ${job.draftId}`;
    if (written === 1) return true;
    // The user replaced the draft meanwhile: the job ends CANCELLED, nothing of it is committed.
    await tx.$executeRaw`
      UPDATE plan_import_jobs SET status = 'CANCELLED', "errorCategory" = 'DRAFT_REPLACED'
      WHERE id = ${job.id} AND attempt = ${job.attempt}`;
    return false;
  });
}

/** Marks this attempt failed (final) or queued again (retry), never touching a reclaimed attempt. */
async function settleFailure(job: ClaimedJob, errorCategory: string, final: boolean) {
  await prisma.planImportJob.updateMany({
    where: { id: job.id, attempt: job.attempt, status: 'RUNNING' },
    data: final
      ? { status: 'FAILED', errorCategory, finishedAt: new Date() }
      : { status: 'QUEUED', errorCategory },
  });
}

async function settleCancelled(job: ClaimedJob, errorCategory: string) {
  await prisma.planImportJob.updateMany({
    where: { id: job.id, attempt: job.attempt, status: 'RUNNING' },
    data: { status: 'CANCELLED', errorCategory, finishedAt: new Date() },
  });
}

// ─── Output → draft ───────────────────────────────────────────────────────

/**
 * The validated import output becomes a `PlanDraft`: every slot/option/item
 * gets a key, `slotIndex` becomes `slotKey`, uncertainties become questions,
 * and the derived daily targets are computed (tech spec § 5.1).
 */
export function draftFromImport(output: PlanImportOutput): PlanDraft {
  const slots: DraftSlot[] = output.slots.map((slot, slotIndex) => ({
    key: randomUUID(),
    weekday: output.structure === 'BY_WEEKDAY' ? slot.weekday : 7,
    position: slotIndex,
    originalName: slot.originalName,
    englishLabel: slot.englishLabel,
    timeStart: slot.timeStart,
    timeEnd: slot.timeEnd,
    sourceExcerpt: slot.sourceExcerpt,
    reviewed: false,
    options: slot.options.map((option, optionIndex) => ({
      key: randomUUID(),
      position: optionIndex,
      label: option.label,
      items: option.items.map((item, itemIndex) => ({
        key: randomUUID(),
        position: itemIndex,
        originalName: item.originalName,
        englishLabel: item.englishLabel,
        quantity: item.quantity,
        unit: item.unit,
        quantityAssumed: item.quantityAssumed,
        assumedDefaultKey: item.assumedDefaultKey,
        preparationNote: item.preparationNote,
        alternatives: item.alternatives,
        category: item.category,
        nutrition: item.nutrition,
        sourceExcerpt: item.sourceExcerpt,
        needsEstimate: false,
      })),
    })),
  }));
  const slotKeyAt = (index: number | null) =>
    index === null ? null : (slots[index]?.key ?? undefined);

  const targets: DraftTarget[] = [];
  for (const target of output.targets) {
    const slotKey = slotKeyAt(target.slotIndex);
    if (slotKey === undefined) continue; // points past the slots: dropped, never invented
    targets.push({
      key: randomUUID(),
      slotKey,
      weekday: output.structure === 'BY_WEEKDAY' ? target.weekday : null,
      nutrient: target.nutrient,
      type: target.type,
      low: target.low,
      high: target.high,
      source: 'EXPLICIT',
      sourceExcerpt: target.sourceExcerpt,
    });
  }

  const questions: DraftQuestion[] = [];
  for (const u of output.uncertainties) {
    const item = slots[u.slotIndex]?.options[u.optionIndex]?.items[u.itemIndex];
    const slotKey = slots[u.slotIndex]?.key;
    if (!item || !slotKey) continue;
    questions.push({
      key: randomUUID(),
      slotKey,
      itemKey: item.key,
      question: u.question,
      answered: false,
    });
  }

  const draft: PlanDraft = {
    draftRevision: 0,
    structure: output.structure,
    name: output.name,
    sourceNote: null,
    sourceLanguage: output.sourceLanguage,
    slots,
    targets,
    notes: output.notes.map((note) => ({ key: randomUUID(), ...note })),
    questions,
    reviewed: { meals: false, targets: false, notes: false },
    manualStep: null,
  };
  draft.targets = recomputeDerivedTargets(draft);
  return planDraftSchema.parse(draft);
}

// ─── Work ─────────────────────────────────────────────────────────────────

function userTagFor(ownerId: string): string {
  return createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
}

function mergeResults<T>(primary: AiResult<T>, extra: AiResult<unknown> | null): AiResult<T> {
  if (!extra) return primary;
  return {
    ...primary,
    attempts: [...primary.attempts, ...extra.attempts],
    usage: {
      promptTokens: primary.usage.promptTokens + extra.usage.promptTokens,
      completionTokens: primary.usage.completionTokens + extra.usage.completionTokens,
    },
    durationMs: primary.durationMs + extra.durationMs,
  };
}

/** Items still without nutrition after the import get one baseline call within the same deadline. */
async function fillBaseline(
  draft: PlanDraft,
  deadlineAt: number,
  userTag: string,
): Promise<AiResult<unknown> | null> {
  const pending: BaselineItemInput[] = [];
  const keys: string[] = [];
  for (const slot of draft.slots)
    for (const option of slot.options)
      for (const item of option.items) {
        if (item.nutrition !== null) continue;
        pending.push({
          index: pending.length,
          originalName: item.originalName,
          englishLabel: item.englishLabel,
          quantity: item.quantity,
          unit: item.unit,
          preparationNote: item.preparationNote,
          category: item.category,
        });
        keys.push(item.key);
      }
  if (pending.length === 0 || Date.now() >= deadlineAt) return null;
  const result = await estimatePlanBaseline({ items: pending, deadlineAt, userTag });
  if (!result.ok) return result;
  const byKey = new Map(result.data.items.map((row) => [keys[row.index], row.nutrition]));
  for (const slot of draft.slots)
    for (const option of slot.options)
      for (const item of option.items) {
        const nutrition = byKey.get(item.key);
        if (nutrition) item.nutrition = nutrition;
      }
  draft.targets = recomputeDerivedTargets(draft);
  return result;
}

async function processJob(job: ClaimedJob, ctx: JobContext): Promise<void> {
  const log = logger.child({ job: job.id, attempt: job.attempt, userId: job.userId });
  if (job.attempt > MAX_ATTEMPTS) {
    await settleFailure(job, 'MAX_ATTEMPTS', true);
    return;
  }
  const timer = setInterval(() => {
    heartbeat(job).catch((err: unknown) => log.warn({ err }, 'plan-import heartbeat failed'));
  }, HEARTBEAT_MS);
  timer.unref?.();
  try {
    const plan = await prisma.plan.findFirst({
      where: { userId: job.userId, draftId: job.draftId },
      select: { draftSourceText: true, user: { select: { profile: true } } },
    });
    if (!plan?.draftSourceText) {
      await settleCancelled(job, 'DRAFT_REPLACED');
      return;
    }
    const profileRow = plan.user.profile;
    const profile: ProfileContext = {
      ageYears: profileRow?.ageYears ?? null,
      sex: profileRow?.sex ?? null,
      heightCm: profileRow?.heightCm === null || !profileRow ? null : Number(profileRow.heightCm),
      weightKg: profileRow?.weightKg === null || !profileRow ? null : Number(profileRow.weightKg),
    };
    // One import is one user operation: the first attempt takes the day's admission, retries reuse it.
    const admission = await admitOperation(
      job.userId,
      'PLAN_IMPORT',
      localDateFor(ctx.now, APP_TIME_ZONE),
      ctx.now,
      { retryOfAdmitted: job.attempt > 1 },
    );
    if (!admission.ok) {
      await settleFailure(job, admission.code, true);
      return;
    }

    const deadlineAt = Date.now() + IMPORT_DEADLINE_MS;
    const userTag = userTagFor(job.userId);
    const result = await interpretPlan({
      sourceText: plan.draftSourceText,
      profile,
      deadlineAt,
      userTag,
    });
    if (!result.ok) {
      await finishOperation(admission.callId, result);
      await settleFailure(job, result.reason, job.attempt >= MAX_ATTEMPTS);
      return;
    }
    if (ctx.shouldStop()) {
      // Asked to stop before the baseline: put the job back rather than commit half the work.
      await finishOperation(admission.callId, result);
      await settleFailure(job, 'STOPPED', false);
      return;
    }
    const draft = draftFromImport(result.data);
    const baseline = await fillBaseline(draft, deadlineAt, userTag);
    await finishOperation(admission.callId, mergeResults(result, baseline));
    const written = await finalizeJob(job, draft);
    if (!written)
      log.info('plan-import finalize affected no rows (obsolete attempt or replaced draft)');
  } catch (err) {
    log.error({ err }, 'plan-import attempt failed');
    await settleFailure(job, 'PROVIDER_ERROR', job.attempt >= MAX_ATTEMPTS).catch(() => {});
  } finally {
    clearInterval(timer);
  }
}

/** Runs claimable jobs one after another until none is left or the scheduler asks to stop. */
export async function runPlanImportJobs(ctx: JobContext): Promise<void> {
  while (!ctx.shouldStop()) {
    const job = await claimNextJob();
    if (!job) return;
    await processJob(job, ctx);
  }
}

registerTask({ name: PLAN_IMPORT_TASK, everyMs: 10_000, run: runPlanImportJobs });
