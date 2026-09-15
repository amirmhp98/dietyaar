import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Liveness + readiness probe. Excluded from the auth proxy (see src/proxy.ts)
 * so orchestrators get a real 200/503 instead of a redirect.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    logger.error({ err }, 'Health check: database connectivity failed');
    checks.database = 'error';
  }

  const healthy = Object.values(checks).every((value) => value === 'ok');
  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
