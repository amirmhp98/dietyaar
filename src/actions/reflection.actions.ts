'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireOnboarded } from '@/lib/auth';
import { localDateSchema } from '@/lib/validations/meal';
import { recordEvent } from '@/services/analytics.service';
import * as reflections from '@/services/reflection.service';

const collapsedSchema = z.boolean();

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
      await recordEvent('reflection_opened', { isFallback: card.isFallback }, user.id);
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
    await recordEvent('reflection_updated', { isFallback: card.isFallback }, user.id);
    revalidatePath('/today');
    revalidatePath(`/history/${parsed.data}`);
    return ok(card);
  } catch (error) {
    return fromError(error);
  }
}

export async function setReflectionCollapsedAction(
  localDate: unknown,
  collapsed: unknown,
): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsedDate = localDateSchema.safeParse(localDate);
  if (!parsedDate.success) return fromZodError(parsedDate.error);
  const parsedCollapsed = collapsedSchema.safeParse(collapsed);
  if (!parsedCollapsed.success) return fromZodError(parsedCollapsed.error);
  try {
    await reflections.setCollapsed(user.id, parsedDate.data, parsedCollapsed.data);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
