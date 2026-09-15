import 'server-only';
import { PrismaClient } from '@prisma/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const globalForPrisma = globalThis as unknown as { prismaGlobal?: PrismaClient };

export const prisma =
  globalForPrisma.prismaGlobal ??
  new PrismaClient({
    log: env.PRISMA_LOG_QUERIES ? ['query', 'warn', 'error'] : ['warn', 'error'],
    // Pool tuning belongs in DATABASE_URL:
    //   ?connection_limit=10&pool_timeout=30&connect_timeout=10
  });

// Reuse one client across hot reloads in development.
if (env.NODE_ENV !== 'production') globalForPrisma.prismaGlobal = prisma;

/**
 * Pre-warm the pool so the first request does not pay the connect cost.
 * Skipped during `next build`, which evaluates this module without a database.
 * Failure is non-fatal: Prisma lazy-connects on the first query.
 */
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
const warmupPromise: Promise<void> = isBuildPhase
  ? Promise.resolve()
  : prisma
      .$connect()
      .then(() => {
        logger.info('Prisma connection pool ready');
      })
      .catch((err: unknown) => {
        logger.warn({ err }, 'Prisma pre-connect failed; will retry on first query');
      });

/** Await this when the pool must be ready (e.g. health checks). */
export const ensureConnected = () => warmupPromise;

export default prisma;
