import 'dotenv/config';
import { vi } from 'vitest';

/**
 * Integration project: real Prisma against TEST_DATABASE_URL (see
 * `npm run test:integration`, which migrates it first). Only the framework
 * shims are mocked; Prisma, env and the logger are real.
 */
const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/app_test?schema=public';
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.SCHEDULER_ENABLED = 'false';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? '';

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
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

vi.mock('next/server', () => ({
  after: vi.fn(),
}));
