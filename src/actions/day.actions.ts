'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireOnboarded } from '@/lib/auth';
import {
  localDateSchema,
  markSlotSkippedSchema,
  setDayCompletenessSchema,
} from '@/lib/validations/meal';
import * as dayView from '@/services/day-view.service';
import * as days from '@/services/day.service';

/** Reads are computed on read (decision 013); the client calls them to refresh after a mutation. */
export async function getDayAction(
  localDate: unknown,
): Promise<ActionResult<dayView.DayViewResult>> {
  const user = await requireOnboarded();
  const parsed = localDateSchema.safeParse(localDate);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    return ok(await dayView.getDayView(user.id, parsed.data, new Date()));
  } catch (error) {
    return fromError(error);
  }
}

export async function getSevenDayAction(
  endDate: unknown,
): Promise<ActionResult<dayView.SevenDayResult>> {
  const user = await requireOnboarded();
  const parsed = localDateSchema.safeParse(endDate);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    return ok(await dayView.getSevenDayView(user.id, parsed.data, new Date()));
  } catch (error) {
    return fromError(error);
  }
}

function revalidateDay(localDate: string) {
  revalidatePath('/today');
  revalidatePath('/history');
  revalidatePath(`/history/${localDate}`);
}

export async function markSlotSkippedAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsed = markSlotSkippedSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const { localDate, planSlotId, skipped } = parsed.data;
    await days.markSlotSkipped(user.id, localDate, planSlotId, skipped);
    revalidateDay(localDate);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function setDayCompletenessAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboarded();
  const parsed = setDayCompletenessSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const { localDate, complete } = parsed.data;
    await days.setDayCompleteness(user.id, localDate, complete);
    revalidateDay(localDate);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
