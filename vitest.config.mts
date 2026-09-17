import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(import.meta.dirname, './src') };

/**
 * Two projects (tech spec § 15):
 * - `unit`: mocked Prisma, no network; `npm run test`.
 * - `integration`: real Postgres at TEST_DATABASE_URL (migrated by the npm
 *   script); `npm run test:integration`. Excluded from `npm run test`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/lib/**', 'src/actions/**'],
      exclude: [
        'src/**/*.d.ts',
        'src/__tests__/**',
        // Infrastructure and constants: exercised by the build and e2e, not unit tests.
        'src/lib/prisma.ts',
        'src/lib/logger.ts',
        'src/lib/env.ts',
        'src/lib/app-config.ts',
        'src/lib/preferences.ts',
        'src/lib/theme.ts',
        'src/lib/common-passwords.ts',
        'src/services/jobs/scheduler.ts',
        'src/services/jobs/backup.job.ts',
        'src/services/storage/**',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        'src/lib/rubric/**': { statements: 95 },
        'src/lib/time/**': { statements: 95 },
      },
    },
    testTimeout: 15_000,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['src/__tests__/**/*.test.ts'],
          exclude: ['src/__tests__/integration/**'],
          setupFiles: ['src/__tests__/setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['src/__tests__/integration/**/*.test.ts'],
          setupFiles: ['src/__tests__/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
  resolve: { alias },
});
