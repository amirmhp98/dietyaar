'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import {
  DRAFT_SECTION_PAYLOADS,
  deletePlanSchema,
  draftRevisionSchema,
  sourceTextSchema,
  startManualPlanSchema,
  updateDraftSchema,
  type PlanDraft,
} from '@/lib/validations/plan';
import { PLAN_IMPORT_TASK } from '@/services/jobs/plan-import.job';
import { runJobsNow } from '@/services/jobs/scheduler';
import * as plans from '@/services/plan.service';
import { setOnboardingStep } from '@/services/profile.service';

/**
 * Plan actions (tech spec § 7 "Plan"). `requireAuth` rather than
 * `requireOnboarded`: the onboarding user builds their first plan here.
 */

function revalidatePlanPages() {
  revalidatePath('/plan');
  revalidatePath('/today');
  revalidatePath('/onboarding');
}

export async function startPlanImportAction(
  input: unknown,
): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireAuth();
  const parsed = sourceTextSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const { jobId } = await plans.startImport(user.id, parsed.data.sourceText);
    // The import starts now rather than at the next scheduler tick; claims are atomic.
    after(() => runJobsNow(PLAN_IMPORT_TASK));
    revalidatePlanPages();
    return ok({ jobId });
  } catch (error) {
    return fromError(error);
  }
}

/** Polled every 3 s while the import is pending. */
export async function getPlanImportStatusAction(): Promise<ActionResult<plans.ImportStatus>> {
  const user = await requireAuth();
  try {
    return ok(await plans.getImportStatus(user.id));
  } catch (error) {
    return fromError(error);
  }
}

export async function retryPlanImportAction(): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireAuth();
  try {
    const { jobId } = await plans.retryImport(user.id);
    after(() => runJobsNow(PLAN_IMPORT_TASK));
    revalidatePlanPages();
    return ok({ jobId });
  } catch (error) {
    return fromError(error);
  }
}

export async function cancelPlanImportAction(): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    await plans.cancelImport(user.id);
    revalidatePlanPages();
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function startManualPlanAction(input: unknown): Promise<ActionResult<PlanDraft>> {
  const user = await requireAuth();
  const parsed = startManualPlanSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const draft = await plans.startManual(user.id, parsed.data.structure, parsed.data.name);
    revalidatePlanPages();
    return ok(draft);
  } catch (error) {
    return fromError(error);
  }
}

export async function updatePlanDraftAction(input: unknown): Promise<ActionResult<PlanDraft>> {
  const user = await requireAuth();
  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const payload = DRAFT_SECTION_PAYLOADS[parsed.data.section].safeParse(parsed.data.payload);
  if (!payload.success) return fromZodError(payload.error);
  try {
    // The raw payload goes through: the service only applies the keys the client sent.
    const draft = await plans.updateDraft(
      user.id,
      parsed.data.section,
      parsed.data.payload,
      parsed.data.draftRevision,
    );
    return ok(draft);
  } catch (error) {
    return fromError(error);
  }
}

export async function startPlanEditAction(): Promise<ActionResult<PlanDraft>> {
  const user = await requireAuth();
  try {
    const draft = await plans.startEdit(user.id);
    revalidatePlanPages();
    return ok(draft);
  } catch (error) {
    return fromError(error);
  }
}

/** Manual and edit drafts: estimates missing or changed items before screen 8b. */
export async function estimateDraftBaselineAction(
  input: unknown,
): Promise<ActionResult<PlanDraft>> {
  const user = await requireAuth();
  const parsed = draftRevisionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    return ok(await plans.estimateDraftBaseline(user.id, parsed.data.draftRevision));
  } catch (error) {
    return fromError(error);
  }
}

/** The current draft for the review UI. */
export async function getPlanDraftAction(): Promise<ActionResult<PlanDraft | null>> {
  const user = await requireAuth();
  try {
    const plan = await plans.getPlan(user.id);
    return ok(plan?.draftJson ?? null);
  } catch (error) {
    return fromError(error);
  }
}

export async function confirmPlanAction(
  input: unknown,
): Promise<ActionResult<{ affectedMeals: number }>> {
  const user = await requireAuth();
  const parsed = draftRevisionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const result = await plans.confirmPlan(user.id, parsed.data.draftRevision);
    if (user.onboardingStep === 'PLAN' || user.onboardingStep === 'REVIEW')
      await setOnboardingStep(user.id, 'READY');
    revalidatePlanPages();
    revalidatePath('/history');
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function discardPlanDraftAction(): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    await plans.discardDraft(user.id);
    revalidatePlanPages();
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function deletePlanAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = deletePlanSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await plans.deletePlan(user.id, parsed.data.confirmation);
    revalidatePlanPages();
    revalidatePath('/history');
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
