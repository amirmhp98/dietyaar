import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobs = vi.hoisted(() => ({ runJobsNow: vi.fn(async () => {}) }));
vi.mock('@/services/jobs/scheduler', () => jobs);
vi.mock('@/services/jobs/all-jobs', () => ({}));
vi.mock('@/services/jobs/registry', () => ({
  taskByName: (name: string) => (name === 'cleanup' ? { name } : undefined),
}));

import { env } from '@/lib/env';
import { GET } from '@/app/api/cron/[task]/route';

const SECRET = 'cron-secret';
const call = (task: string, authorization?: string) =>
  GET(
    new NextRequest(`http://localhost:3000/api/cron/${task}`, {
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({ task }) },
  );

describe('GET /api/cron/[task]', () => {
  beforeEach(() => {
    (env as { CRON_SECRET?: string }).CRON_SECRET = SECRET;
    jobs.runJobsNow.mockClear();
  });

  it('answers 404 when no secret is configured (scheduler hosts)', async () => {
    (env as { CRON_SECRET?: string }).CRON_SECRET = undefined;
    const response = await call('all', `Bearer ${SECRET}`);
    expect(response.status).toBe(404);
    expect(jobs.runJobsNow).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong bearer token', async () => {
    expect((await call('all')).status).toBe(401);
    expect((await call('all', 'Bearer nope')).status).toBe(401);
    expect(jobs.runJobsNow).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown task', async () => {
    expect((await call('nope', `Bearer ${SECRET}`)).status).toBe(404);
    expect(jobs.runJobsNow).not.toHaveBeenCalled();
  });

  it('runs one named task', async () => {
    const response = await call('cleanup', `Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(jobs.runJobsNow).toHaveBeenCalledWith('cleanup');
    await expect(response.json()).resolves.toMatchObject({ task: 'cleanup' });
  });

  it('runs every task for `all`', async () => {
    expect((await call('all', `Bearer ${SECRET}`)).status).toBe(200);
    expect(jobs.runJobsNow).toHaveBeenCalledWith(undefined);
  });
});
