import type { PrismaClient } from '@prisma/client';
import { beforeEach } from 'vitest';
import { mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { prisma } from '@/lib/prisma';

/** The deep-mocked Prisma client installed by setup.ts, with full Prisma types. */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

/**
 * Call once at the top of a test file to reset the mock between tests:
 *   import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
 *   resetPrismaMock();
 */
export function resetPrismaMock() {
  beforeEach(() => {
    mockReset(prismaMock);
  });
}
