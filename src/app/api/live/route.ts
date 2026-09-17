import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe (tech spec § 13): answers as long as the process serves
 * requests. No database, no dependencies — readiness is `/api/health`.
 * Excluded from the auth proxy like every `/api/*` route.
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
