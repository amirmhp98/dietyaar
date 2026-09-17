'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { APPEARANCE_COOKIE, appearanceCookieOptions } from '@/lib/theme-cookie';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-cookie';
import { t } from '@/lib/t';
import { changePasswordSchema, deleteAccountSchema, signUpSchema } from '@/lib/validations/account';
import * as account from '@/services/account.service';
import { isRateLimited } from '@/services/rate-limit.service';

export type SignUpState = { error?: string } | null;

const SIGNUP_LIMIT = 10;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

/** Bound to `useActionState` in the sign-up form. 10 per IP per hour (tech spec § 8). */
export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t('validation.invalid') };

  const ip = (await headers()).get('x-real-ip') ?? 'unknown';
  if (isRateLimited(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)) {
    return { error: t('signup.errors.rateLimited') };
  }

  let session;
  try {
    session = await account.signUp(parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  cookieStore.set(APPEARANCE_COOKIE, 'system', appearanceCookieOptions());
  redirect('/onboarding');
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  try {
    await account.changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      token,
    );
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function requestAccountDeletionAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await account.requestDeletion(user.id, parsed.data.username);
  } catch (error) {
    return fromError(error);
  }
  (await cookies()).delete(SESSION_COOKIE);
  return ok();
}

/** Under-18 stop screen: one tap, no confirmation loop. */
export async function deleteUnderageAccountAction(): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    await account.deleteUnderageAccount(user.id);
  } catch (error) {
    return fromError(error);
  }
  (await cookies()).delete(SESSION_COOKIE);
  return ok();
}
