import { defineConfig, devices } from '@playwright/test';
import { DEFAULT_LOCALE, LOCALES } from '../src/lib/locale';
import { APP_TIME_ZONE } from '../src/lib/time/zone';

/**
 * E2E tests run against a real dev server, a real Postgres and the stub
 * DeepSeek server (e2e/stub-ai). Locally:
 *   npm run db:up && npm run db:deploy && npm run db:seed && npm run test:e2e
 * Override PORT to run beside another dev server.
 *
 * Projects (tech spec § 15): `auth` (no stored state), `chromium` (Desktop
 * Chrome) and `mobile` (Pixel 7) share the `demo` user's stored session.
 * Specs read their copy through t(); the browser runs in the app zone
 * (decision 022), so fixed clocks are derived from it.
 */
const profile = LOCALES[DEFAULT_LOCALE];
const PORT = process.env.PORT ?? '3000';
const AI_PORT = process.env.AI_STUB_PORT ?? '3999';
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    locale: profile.tag,
    timezoneId: APP_TIME_ZONE,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'auth',
      testMatch: /(auth|signup|onboarding)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /(auth|signup|onboarding)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      testIgnore: /(auth|signup|onboarding|admin-users)\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: `node stub-ai/server.mjs --port ${AI_PORT}`,
      cwd: __dirname,
      url: `http://localhost:${AI_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --port ${PORT}`,
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DEEPSEEK_API_BASE_URL: `http://localhost:${AI_PORT}`,
        DEEPSEEK_API_KEY: 'stub-key',
        SCHEDULER_ENABLED: 'true',
        SIGNUP_RATE_LIMIT: '100000',
        PHOTO_LOGGING_ENABLED: 'true',
      },
    },
  ],
});
