import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { registeredTasks, taskByName, type JobTask } from '@/services/jobs/registry';

/**
 * In-process scheduler under a lease row (tech spec § 12, decision 010).
 * Every 20 s the process renews `job_locks.name = 'scheduler'` for 60 s; a
 * row count of 1 means it holds the lease and may schedule. Losing the lease
 * raises `shouldStop` for running tasks and stops scheduling until it is won
 * again. Tasks never overlap themselves and run at most ten minutes.
 * `runJobsNow()` runs a task on demand (`after()` from an action) regardless
 * of the lease; the tasks are written to be safe under concurrent runners.
 */

export const LEASE_NAME = 'scheduler';
export const LEASE_RENEW_MS = 20_000;
/** The lease length is the literal in `renewLease`'s SQL. */
export const LEASE_MS = 60_000;
export const TICK_MS = 5_000;
export const TASK_CEILING_MS = 10 * 60_000;

interface SchedulerState {
  holder: string;
  leaseHeld: boolean;
  leaseTimer: NodeJS.Timeout | null;
  tickTimer: NodeJS.Timeout | null;
  running: Map<string, Promise<void>>;
  lastRun: Map<string, number>;
}

// One scheduler per process, surviving HMR module reloads in development.
const globalScope = globalThis as unknown as { __dietyaarScheduler?: SchedulerState };

function state(): SchedulerState {
  globalScope.__dietyaarScheduler ??= {
    holder: randomUUID(),
    leaseHeld: false,
    leaseTimer: null,
    tickTimer: null,
    running: new Map(),
    lastRun: new Map(),
  };
  return globalScope.__dietyaarScheduler;
}

async function loadTasks(): Promise<void> {
  await import('@/services/jobs/all-jobs');
}

/** Seeds the row lazily; a plain row works through the transaction pooler. */
async function ensureLockRow(): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO job_locks (id, name, holder, "lockedUntil", "updatedAt")
    VALUES (${randomUUID()}, ${LEASE_NAME}, NULL, now() - interval '1 second', now())
    ON CONFLICT (name) DO NOTHING`;
}

/** Renews (or wins) the lease; returns whether this process holds it now. */
export async function renewLease(): Promise<boolean> {
  const s = state();
  const count = await prisma.$executeRaw`
    UPDATE job_locks
    SET holder = ${s.holder}, "lockedUntil" = now() + interval '60 seconds', "updatedAt" = now()
    WHERE name = ${LEASE_NAME} AND ("lockedUntil" < now() OR holder = ${s.holder})`;
  const held = count === 1;
  if (held !== s.leaseHeld) logger.info({ holder: s.holder, held }, 'scheduler lease changed');
  s.leaseHeld = held;
  return held;
}

/** Runs one task with the stop flag and the ten-minute ceiling; a task never overlaps itself. */
export function runTask(task: JobTask, requireLease: boolean): Promise<void> {
  const s = state();
  const inFlight = s.running.get(task.name);
  if (inFlight) return inFlight;
  const startedAt = Date.now();
  const ctx = {
    now: new Date(startedAt),
    shouldStop: () => (requireLease && !s.leaseHeld) || Date.now() - startedAt > TASK_CEILING_MS,
  };
  const promise = task
    .run(ctx)
    .catch((err: unknown) => logger.error({ err, task: task.name }, 'scheduler task failed'))
    .finally(() => {
      s.running.delete(task.name);
      s.lastRun.set(task.name, Date.now());
    });
  s.running.set(task.name, promise);
  return promise;
}

function isDue(task: JobTask, now: Date, lastRun: number | undefined): boolean {
  if (task.atUtcHour !== undefined) {
    if (now.getUTCHours() !== task.atUtcHour) return false;
    return (
      lastRun === undefined ||
      new Date(lastRun).toISOString().slice(0, 10) !== now.toISOString().slice(0, 10)
    );
  }
  return lastRun === undefined || now.getTime() - lastRun >= task.everyMs;
}

/** One scheduling pass: only while the lease is held, only tasks that are due. */
export function tick(now = new Date()): void {
  const s = state();
  if (!s.leaseHeld) return;
  for (const task of registeredTasks()) {
    if (s.running.has(task.name) || !isDue(task, now, s.lastRun.get(task.name))) continue;
    void runTask(task, true);
  }
}

/** Idempotent: one lease loop and one tick loop per process. */
export async function startScheduler(): Promise<void> {
  const s = state();
  if (s.leaseTimer) return;
  await loadTasks();
  try {
    await ensureLockRow();
    await renewLease();
  } catch (err) {
    logger.warn({ err }, 'scheduler could not reach the lock row; will retry');
  }
  s.leaseTimer = setInterval(() => {
    renewLease().catch((err: unknown) => {
      // A failed renewal counts as a lost lease: running tasks stop at their next checkpoint.
      s.leaseHeld = false;
      logger.warn({ err }, 'scheduler lease renewal failed');
    });
  }, LEASE_RENEW_MS);
  s.tickTimer = setInterval(() => tick(), TICK_MS);
  s.leaseTimer.unref?.();
  s.tickTimer.unref?.();
  tick();
  logger.info({ holder: s.holder }, 'scheduler started');
}

/** Stops the loops (tests and shutdown); running tasks see `shouldStop`. */
export function stopScheduler(): void {
  const s = state();
  if (s.leaseTimer) clearInterval(s.leaseTimer);
  if (s.tickTimer) clearInterval(s.tickTimer);
  s.leaseTimer = null;
  s.tickTimer = null;
  s.leaseHeld = false;
}

/**
 * Runs a task (or every task) right away, lease or not — used by `after()`
 * from the start action so an import begins without waiting for a tick. A
 * task already in flight is awaited instead of started twice.
 */
export async function runJobsNow(taskName?: string): Promise<void> {
  await loadTasks();
  const tasks = taskName
    ? [taskByName(taskName)].filter((t): t is JobTask => !!t)
    : registeredTasks();
  await Promise.all(tasks.map((task) => runTask(task, false)));
}
