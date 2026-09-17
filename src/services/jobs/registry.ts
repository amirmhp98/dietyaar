/**
 * Scheduler task registry (tech spec § 12). Task modules register themselves
 * at import time; `all-jobs.ts` imports every module and the scheduler reads
 * the list. Tasks check `ctx.shouldStop()` between units of work and never
 * run longer than ten minutes.
 */
export interface JobContext {
  shouldStop: () => boolean;
  now: Date;
}

export interface JobTask {
  name: string;
  /** Cadence in milliseconds; the scheduler also runs `runNow` on demand. */
  everyMs: number;
  run: (ctx: JobContext) => Promise<void>;
  /** Optional: only run at this UTC hour (e.g. backups at 03:00). */
  atUtcHour?: number;
}

const tasks = new Map<string, JobTask>();

export function registerTask(task: JobTask): void {
  tasks.set(task.name, task);
}

export function registeredTasks(): JobTask[] {
  return [...tasks.values()];
}

export function taskByName(name: string): JobTask | undefined {
  return tasks.get(name);
}
