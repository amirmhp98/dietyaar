import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/**
 * Coarse gate only: "is there a session cookie at all?".
 * Real validation (expiry, deactivated user) happens in `requireAuth`, which
 * runs in the page layout. The login page decides for itself whether an
 * existing cookie is still valid, so a stale cookie can never bounce between
 * /login and / (the redirect loop the previous version had).
 */

const PUBLIC_ROUTES = ['/login', '/signup'];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default function proxy(request: NextRequest) {
  // Development-only bypass (validated in src/lib/env.ts; never true in production).
  if (process.env.SKIP_AUTH === 'true') return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes (health checks must answer without a cookie),
  // Next.js internals, and static assets.
  matcher: [
    '/((?!api/|_next/|favicon\\.ico|icon\\.svg|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
