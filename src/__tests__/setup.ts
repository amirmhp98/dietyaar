import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// `server-only` throws outside a React Server Components bundle; make it inert here.
vi.mock('server-only', () => ({}));

// Validated env — deterministic values so tests never read a real .env.
vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SESSION_MAX_AGE_DAYS: 90,
    SKIP_AUTH: false,
    LOG_LEVEL: 'silent',
    PRISMA_LOG_QUERIES: false,
    S3_KEY_PREFIX: '',
    STORAGE_SOFT_LIMIT_BYTES: 734_003_200,
    BACKUP_ENABLED: false,
    BACKUP_RETENTION_DAYS: 30,
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_API_BASE_URL: 'http://ai.test',
    AI_MODEL_TEXT: 'deepseek-flash',
    AI_MODEL_VISION: 'deepseek-flash',
    AI_DAILY_TOKEN_BUDGET: 5_000_000,
    PHOTO_LOGGING_ENABLED: false,
    USDA_LOOKUP_ENABLED: false,
    SCHEDULER_ENABLED: false,
  },
  storageConfigured: false,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    has: vi.fn(() => false),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Prisma singleton → deep mock. Tests reach it through helpers/prisma-mock.ts.
vi.mock('@/lib/prisma', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  const prismaMock = mockDeep<PrismaClient>();
  return { default: prismaMock, prisma: prismaMock, ensureConnected: vi.fn() };
});

// Silence the logger.
vi.mock('@/lib/logger', () => {
  const child = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const loggerMock = { ...child, fatal: vi.fn(), trace: vi.fn(), child: vi.fn(() => child) };
  return { default: loggerMock, logger: loggerMock };
});

if (!process.env.DEBUG_TESTS) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}
