'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import { APPEARANCE_COOKIE, appearanceCookieOptions } from '@/lib/theme-cookie';
import {
  STEP_SCHEMAS,
  aiNoticeKindSchema,
  onboardingStepSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '@/lib/validations/profile';
import * as profiles from '@/services/profile.service';

export async function saveOnboardingStepAction(
  step: unknown,
  values: unknown,
): Promise<ActionResult<profiles.SaveStepResult>> {
  const user = await requireAuth();
  const parsedStep = onboardingStepSchema.safeParse(step);
  if (!parsedStep.success) return fromZodError(parsedStep.error);
  const parsed = STEP_SCHEMAS[parsedStep.data].safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const result = await profiles.saveOnboardingStep(
      user.id,
      parsedStep.data,
      parsed.data as never,
    );
    revalidatePath('/onboarding');
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await profiles.updateProfile(user.id, parsed.data);
    revalidatePath('/settings');
    revalidatePath('/today');
    revalidatePath('/plan');
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function updatePreferencesAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = updatePreferencesSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const profile = await profiles.updatePreferences(user.id, parsed.data);
    if (parsed.data.appearance) {
      (await cookies()).set(
        APPEARANCE_COOKIE,
        profile.appearance.toLowerCase(),
        appearanceCookieOptions(),
      );
    }
    revalidatePath('/', 'layout');
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function acknowledgeAiNoticeAction(kind: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = aiNoticeKindSchema.safeParse(kind);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await profiles.acknowledgeAiNotice(user.id, parsed.data);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

/** "I don't have a plan yet" → limited Today (product spec § 5). */
export async function skipPlanAction(): Promise<void> {
  const user = await requireAuth();
  await profiles.setOnboardingStep(user.id, 'DONE');
  redirect('/today');
}
