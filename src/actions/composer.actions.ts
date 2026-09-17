'use server';

import { type ActionResult, fail, fromError, ok } from '@/lib/action-result';
import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';
import * as meals from '@/services/meal.service';
import { getProfile } from '@/services/profile.service';

/**
 * Reads the meal composer needs when it opens (design-scope screen 4). The
 * shell layout only passes the zone and the photo flag; the notice flags and
 * the restriction list come from here so the composer stays self-contained.
 */
export interface ComposerContext {
  aiNoticeMealTextShown: boolean;
  aiNoticePhotoShown: boolean;
  restrictions: string[];
}

export async function getComposerContextAction(): Promise<ActionResult<ComposerContext>> {
  const user = await requireOnboarded();
  try {
    const profile = await getProfile(user.id);
    return ok({
      aiNoticeMealTextShown: profile?.aiNoticeMealTextShownAt !== null,
      aiNoticePhotoShown: profile?.aiNoticePhotoShownAt !== null,
      restrictions: profile?.restrictionsOriginal ?? [],
    });
  } catch (error) {
    return fromError(error);
  }
}

/** The option the user chose the last time they logged this slot ("Last time"). */
export async function getLastUsedOptionAction(
  planSlotId: unknown,
): Promise<ActionResult<string | null>> {
  const user = await requireOnboarded();
  if (typeof planSlotId !== 'string' || planSlotId.length === 0)
    return fail(t('validation.invalid'));
  try {
    return ok(await meals.lastUsedOptionId(user.id, planSlotId));
  } catch (error) {
    return fromError(error);
  }
}
