'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireOnboarded } from '@/lib/auth';
import { localDateSchema } from '@/lib/validations/meal';
import { acknowledgeReflectionSchema } from '@/lib/validations/reflection';
import { recordEvent } from '@/services/analytics.service';
import * as reflections from '@/services/reflection.service';

/**
 * First visit of the local day (product spec § 11): claims or reads the
 * message. The client polls every 2 s while GENERATING, up to 25 s, past the
 * 20 s takeover point so a dead owner is always recovered by one of the polls.
 */
export async function getMorningMessageAction(
  localDate: unknown,
): Promise<ActionResult<reflections.ReflectionCard>> {
  const user = await requireOnboarded();
  const parsed = localDateSchema.safeParse(localDate);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const card = await reflections.getOrCreateMessage(user.id, parsed.data, new Date());
    if (card.status === 'READY') {
      await recordEvent(
        'reflection_opened',
        { isFallback: card.isFallback, isStatic: card.isStatic },
        user.id,
      );
    }
    return ok(card);
  } catch (error) {
    return fromError(error);
  }
}

/** Regenerates in place; counts toward the daily reflection cap. */
export async function updateReflectionAction(
  localDate: unknown,
): Promise<ActionResult<reflections.ReflectionCard>> {
  const user = await requireOnboarded();
  const parsed = localDateSchema.safeParse(localDate);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const card = await reflections.updateMessage(user.id, parsed.data, new Date());
    await recordEvent(
      'reflection_updated',
      { isFallback: card.isFallback, isStatic: card.isStatic },
      user.id,
    );
    revalidatePath('/today');
    revalidatePath(`/history/${parsed.data}`);
    return ok(card);
  } catch (error) {
    return fromError(error);
  }
}

/** "Got it": the card moves to the bottom of Today for the rest of that date, on every device. */
export async function acknowledgeReflectionAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsed = acknowledgeReflectionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await reflections.acknowledge(user.id, parsed.data.localDate, new Date());
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
