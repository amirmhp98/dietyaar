import 'server-only';
import { env } from '@/lib/env';
import { photo } from '@/messages/sections/photo';

/**
 * CSRF guard for mutating route handlers (tech spec § 8): the `Origin` header
 * must equal `APP_URL`'s origin. Server actions are same-origin by
 * construction; only `/api/*` handlers need this. A browser always sends
 * `Origin` on a cross-site or non-GET request, so a missing header is
 * refused too.
 */

// Pending `t()` migration: the photo section is not wired into en.ts yet.
const msg = (key: keyof typeof photo) => photo[key];

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(env.APP_URL).origin;
  } catch {
    return false;
  }
}

/** A 403 response to return when the request is not same-origin, otherwise null. */
export function assertSameOrigin(request: Request): Response | null {
  if (isSameOrigin(request)) return null;
  return Response.json({ code: 'FORBIDDEN', error: msg('photo.errors.origin') }, { status: 403 });
}
