'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionResult, fromError, ok } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import * as plans from '@/services/plan.service';
import { setOnboardingStep } from '@/services/profile.service';

/**
 * Onboarding plan screens (design-scope screens 7b and 9) and the confirm
 * line of the review flow. Kept apart from plan.actions.ts so the plan
 * contract stays as the backend wave left it.
 */

/** Screen 7b "Continue to Today": onboarding ends while the import keeps running. */
export async function continueToTodayAction(): Promise<void> {
  const user = await requireAuth();
  if (user.onboardingStep !== 'DONE') await setOnboardingStep(user.id, 'DONE');
  revalidatePath('/today');
  redirect('/today');
}

/** Screen 9 "Ready": both buttons finish onboarding; the client picks the destination. */
export async function finishOnboardingAction(): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    if (user.onboardingStep !== 'DONE') await setOnboardingStep(user.id, 'DONE');
    revalidatePath('/today');
    revalidatePath('/plan');
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

/** The "N meals affected" line before Confirm plan (product spec § 6). */
export async function countAffectedMealsAction(): Promise<ActionResult<{ affectedMeals: number }>> {
  const user = await requireAuth();
  try {
    const plan = await plans.getPlan(user.id);
    if (!plan?.draftJson) return ok({ affectedMeals: 0 });
    return ok({ affectedMeals: await plans.countAffectedMeals(user.id, plan.draftJson) });
  } catch (error) {
    return fromError(error);
  }
}
