'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, fail, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireOnboarded } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';
import {
  analyzeMealDraftSchema,
  createMealDraftSchema,
  deleteMealSchema,
  reuseMealSchema,
  saveMealSchema,
  setMealLinkSchema,
  updateMealDraftSchema,
  updateMealSchema,
  uploadIdSchema,
} from '@/lib/validations/meal';
import { recordEvent } from '@/services/analytics.service';
import * as meals from '@/services/meal.service';
import { removeUpload } from '@/services/upload.service';

/**
 * Meal actions (tech spec § 7 "Meal"). `markSlotSkippedAction` and
 * `setDayCompletenessAction` live in `day.actions.ts`. Analytics carry
 * operational metadata only: never food names, text or values.
 */

function revalidateMealPages(mealId?: string, localDate?: string): void {
  revalidatePath('/today');
  revalidatePath('/history');
  if (localDate) revalidatePath(`/history/${localDate}`);
  if (mealId) revalidatePath(`/meals/${mealId}`);
}

function codeOf(error: unknown): string {
  return error instanceof ServiceError ? error.code : 'UNEXPECTED';
}

export async function createMealDraftAction(
  input: unknown,
): Promise<ActionResult<meals.CreateDraftResult>> {
  const user = await requireOnboarded();
  const parsed = createMealDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const result = await meals.createDraft(user.id, parsed.data, new Date());
    if (result.draft) {
      await recordEvent('meal_draft_created', { kind: parsed.data.kind }, user.id);
    }
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function analyzeMealDraftAction(
  input: unknown,
): Promise<ActionResult<meals.MealDraftView>> {
  const user = await requireOnboarded();
  const parsed = analyzeMealDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const startedAt = Date.now();
  try {
    const draft = await meals.analyzeDraft(
      user.id,
      parsed.data.draftId,
      parsed.data.expectedRevision,
      new Date(),
    );
    await recordEvent(
      draft.analysisStatus === 'DONE' ? 'analysis_succeeded' : 'analysis_failed',
      {
        kind: draft.state.kind,
        durationMs: Date.now() - startedAt,
        reason: draft.analysisFailureReason,
      },
      user.id,
    );
    return ok(draft);
  } catch (error) {
    await recordEvent(
      'analysis_failed',
      { durationMs: Date.now() - startedAt, reason: codeOf(error) },
      user.id,
    );
    return fromError(error);
  }
}

export async function updateMealDraftAction(
  input: unknown,
): Promise<ActionResult<{ draft: meals.MealDraftView; preview: meals.DraftPreview }>> {
  const user = await requireOnboarded();
  const parsed = updateMealDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const result = await meals.updateDraft(
      user.id,
      parsed.data.draftId,
      parsed.data.expectedRevision,
      parsed.data.edits,
      new Date(),
    );
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function saveMealAction(input: unknown): Promise<ActionResult<meals.MealView>> {
  const user = await requireOnboarded();
  const parsed = saveMealSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const meal = await meals.saveMeal(
      user.id,
      parsed.data.draftId,
      parsed.data.expectedRevision,
      parsed.data.clientRequestId,
      new Date(),
    );
    await recordEvent(
      'meal_save_succeeded',
      { kind: meal.inputKind, linked: meal.planSlotId !== null, items: meal.items.length },
      user.id,
    );
    revalidateMealPages(meal.id, meal.localDate);
    return ok(meal);
  } catch (error) {
    const code = codeOf(error);
    await recordEvent(
      code === 'CONFLICT' ? 'meal_save_conflict' : 'meal_save_failed',
      { code },
      user.id,
    );
    return fromError(error);
  }
}

export async function updateMealAction(input: unknown): Promise<ActionResult<meals.MealView>> {
  const user = await requireOnboarded();
  const parsed = updateMealSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const meal = await meals.updateMeal(
      user.id,
      parsed.data.mealId,
      parsed.data.expectedRevision,
      parsed.data.edits,
      new Date(),
    );
    revalidateMealPages(meal.id, meal.localDate);
    return ok(meal);
  } catch (error) {
    if (codeOf(error) === 'CONFLICT') {
      await recordEvent('meal_save_conflict', { code: 'CONFLICT', edit: true }, user.id);
    }
    return fromError(error);
  }
}

export async function deleteMealAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsed = deleteMealSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await meals.deleteMeal(user.id, parsed.data.mealId, parsed.data.expectedRevision);
    await recordEvent('meal_deleted', {}, user.id);
    revalidateMealPages(parsed.data.mealId);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function setMealLinkAction(input: unknown): Promise<ActionResult<meals.MealView>> {
  const user = await requireOnboarded();
  const parsed = setMealLinkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const meal = await meals.setMealLink(
      user.id,
      parsed.data.mealId,
      parsed.data.expectedRevision,
      parsed.data.planSlotId,
      parsed.data.planOptionId,
    );
    revalidateMealPages(meal.id, meal.localDate);
    return ok(meal);
  } catch (error) {
    return fromError(error);
  }
}

export async function reuseMealAction(
  input: unknown,
): Promise<ActionResult<meals.CreateDraftResult>> {
  const user = await requireOnboarded();
  const parsed = reuseMealSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const result = await meals.reuseMeal(
      user.id,
      parsed.data.mealId,
      parsed.data.clientRequestId,
      parsed.data.localDate,
      new Date(),
    );
    if (result.draft) await recordEvent('meal_draft_created', { kind: 'RECENT' }, user.id);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

/** Sets the upload `REMOVED` and deletes the object; the draft's `uploadIds` are edited by the client. */
export async function removeMealPhotoAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsed = uploadIdSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await removeUpload(user.id, parsed.data.uploadId);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function getMealDraftAction(
  draftId: unknown,
): Promise<ActionResult<meals.MealDraftView>> {
  const user = await requireOnboarded();
  if (typeof draftId !== 'string' || draftId.length === 0) return fail(t('validation.invalid'));
  try {
    return ok(await meals.getDraft(user.id, draftId));
  } catch (error) {
    return fromError(error);
  }
}

export async function getRecentMealsAction(): Promise<ActionResult<meals.RecentMeal[]>> {
  const user = await requireOnboarded();
  try {
    return ok(await meals.listRecentMeals(user.id));
  } catch (error) {
    return fromError(error);
  }
}
