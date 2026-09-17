/**
 * Starts the in-process scheduler once per Node.js server (tech spec § 12).
 * Guarded so the edge runtime and `next build` never start it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { env } = await import('@/lib/env');
  if (!env.SCHEDULER_ENABLED) return;
  const { startScheduler } = await import('@/services/jobs/scheduler');
  await startScheduler();
}
