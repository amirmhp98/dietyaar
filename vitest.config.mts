import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
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
        'src/lib/fonts.ts',
        'src/lib/i18n.ts',
        'src/lib/app-config.ts',
        'src/lib/preferences.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: { statements: 60, branches: 55, functions: 60 },
    },
    testTimeout: 15_000,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
});
