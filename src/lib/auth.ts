import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { SESSION_COOKIE } from '@/lib/session-cookie';
import { findUserBySessionToken } from '@/services/auth.service';
import type { AuthUser } from '@/types/auth';

/**
 * Next.js-side session helpers for layouts, pages and actions.
 * Business logic (password checks, token hashing, session rows) lives in
 * `services/auth.service.ts`; this file only knows about cookies and redirects.
 */

/** Stand-in user for SKIP_AUTH=true (runs without a database, development only). */
const MOCK_USER: AuthUser = {
  id: 'mock-user-id',
  username: 'admin',
  fullName: 'Admin',
  role: 'ADMIN',
  isActive: true,
  onboardingStep: 'DONE',
};

/** Current user for this request, or null. Deduplicated per request via React cache(). */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  if (env.SKIP_AUTH) return MOCK_USER;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return findUserBySessionToken(token);
});

/** For layouts, pages and actions that need a logged-in user. Redirects to /login otherwise. */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

export type ApiAuth = { ok: true; user: AuthUser } | { ok: false; response: Response };

/**
 * For route handlers: a missing or expired session answers 401 JSON
 * (`{ error: 'UNAUTHENTICATED' }`) instead of the page redirect, so a fetch
 * caller can tell "sign in again" from a network failure.
 */
export async function requireApiAuth(): Promise<ApiAuth> {
  const user = await getSession();
  if (user) return { ok: true, user };
  return {
    ok: false,
    response: Response.json(
      { error: 'UNAUTHENTICATED' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    ),
  };
}

/**
 * Product pages: a signed-in user who has not finished onboarding is sent back
 * to the step they left. Admin and tooling pages do not use this.
 */
export async function requireOnboarded(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.onboardingStep !== 'DONE') redirect('/onboarding');
  return user;
}

/** Admin-only gate. Non-admins are sent to the dashboard. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}
