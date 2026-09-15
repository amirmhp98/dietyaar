'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireAdmin } from '@/lib/auth';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdSchema,
} from '@/lib/validations/user';
import * as users from '@/services/user.service';

/**
 * Thin wrappers: authorise → validate → call the service → revalidate.
 * Inputs are `unknown` on purpose: anything a client sends is untrusted
 * until the zod schema has accepted it.
 */

const USERS_PATH = '/admin/users';

export async function createUserAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await users.createUser(parsed.data);
    revalidatePath(USERS_PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function updateUserAction(userId: unknown, input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = userIdSchema.safeParse(userId);
  const parsed = updateUserSchema.safeParse(input);
  if (!id.success) return fromZodError(id.error);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await users.updateUser(id.data, parsed.data, admin.id);
    revalidatePath(USERS_PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function setUserActiveAction(
  userId: unknown,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return fromZodError(id.error);

  try {
    await users.setUserActive(id.data, Boolean(isActive), admin.id);
    revalidatePath(USERS_PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function resetPasswordAction(userId: unknown, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const id = userIdSchema.safeParse(userId);
  const parsed = resetPasswordSchema.safeParse(input);
  if (!id.success) return fromZodError(id.error);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await users.resetPassword(id.data, parsed.data.password);
    revalidatePath(USERS_PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
