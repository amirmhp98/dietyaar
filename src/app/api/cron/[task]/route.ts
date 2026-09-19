import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { runJobsNow } from '@/services/jobs/scheduler';
import { taskByName } from '@/services/jobs/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Runs one scheduler task (or `all` of them) on demand for hosts without a
 * long-lived process (decision 021: Vercel's cron calls this with
 * `Authorization: Bearer $CRON_SECRET`). The tasks are already safe under
 * concurrent runners, so this reuses `runJobsNow` exactly as `after()` from
 * the import action does. Excluded from the auth proxy like every `/api/*`
 * route; the secret is the only gate.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/cron/[task]'>) {
  if (!env.CRON_SECRET) return new NextResponse(null, { status: 404 });

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;
  const authorised =
    header.length === expected.length &&
    timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!authorised) return new NextResponse(null, { status: 401 });

  const { task } = await ctx.params;
  await import('@/services/jobs/all-jobs');
  if (task !== 'all' && !taskByName(task)) return new NextResponse(null, { status: 404 });

  const startedAt = Date.now();
  await runJobsNow(task === 'all' ? undefined : task);
  const ms = Date.now() - startedAt;
  logger.info({ task, ms }, 'cron task finished');
  return NextResponse.json({ task, ms }, { headers: { 'Cache-Control': 'no-store' } });
}
