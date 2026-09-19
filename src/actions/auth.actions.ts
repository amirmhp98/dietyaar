'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ServiceError } from '@/lib/errors';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-cookie';
import { t } from '@/lib/t';
import { APPEARANCE_COOKIE } from '@/lib/theme-cookie';
import { loginSchema } from '@/lib/validations/auth';
import { authenticate, revokeSession } from '@/services/auth.service';

export type LoginState = { error?: string } | null;

/** Bound to `useActionState` in the login form. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t('validation.invalid') };
  }

  let session;
  try {
    session = await authenticate(parsed.data.username, parsed.data.password);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  if (!session) return { error: t('auth.errors.invalidCredentials') };

  (await cookies()).set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  redirect('/');
}

/** Ends the session and forgets the appearance, so the next person on the device starts from system. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(APPEARANCE_COOKIE);
  redirect('/login');
}
