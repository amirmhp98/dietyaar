import { logger } from '@/lib/logger';
import { registerTask, type JobContext } from '@/services/jobs/registry';
import { expireDrafts } from '@/services/meal.service';
import { deleteUploadsForDrafts, expireStagedUploads } from '@/services/upload.service';

/**
 * Hourly cleanup (tech spec § 12 `cleanupStagedUploads`, TS-§21.18): staged
 * uploads past `expiresAt`, then drafts past `expiresAt` with their staged
 * uploads. Objects go before rows so a failed object delete leaves the row for
 * the next run. `shouldStop` is checked between batches of 50.
 */

const BATCH = 50;
const DRAFT_UPLOAD_BATCH = 50;

export async function runCleanup(ctx: JobContext): Promise<void> {
  let expiredUploads = 0;
  while (!ctx.shouldStop()) {
    const deleted = await expireStagedUploads(ctx.now, BATCH);
    expiredUploads += deleted;
    if (deleted < BATCH) break;
  }

  let draftUploads = 0;
  let drafts = 0;
  if (!ctx.shouldStop()) {
    const expired = await expireDrafts(ctx.now);
    drafts = expired.deleted;
    for (let i = 0; i < expired.uploadIds.length && !ctx.shouldStop(); i += DRAFT_UPLOAD_BATCH) {
      draftUploads += await deleteUploadsForDrafts(
        expired.uploadIds.slice(i, i + DRAFT_UPLOAD_BATCH),
      );
    }
  }

  if (expiredUploads || drafts || draftUploads) {
    logger.info({ expiredUploads, drafts, draftUploads }, 'cleanup finished');
  }
}

registerTask({ name: 'cleanup', everyMs: 60 * 60 * 1000, run: runCleanup });
