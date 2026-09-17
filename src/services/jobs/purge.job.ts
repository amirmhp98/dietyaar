import { storageConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { deleteUserObjects } from '@/services/upload.service';
import { PHOTO_PREFIX } from '@/services/jobs/backup-core';
import { backupStore } from '@/services/jobs/backup.job';
import { registerTask, type JobContext } from '@/services/jobs/registry';

/**
 * Hourly purge (tech spec § 12 `purgeDeletedAccounts`, product spec § 15):
 * for every user past `deletionScheduledFor`, delete their photo objects,
 * their `photos/{key}` copies in the backup bucket, then the `User` row
 * (every product table cascades). Storage steps are skipped when the bucket
 * in question is not configured. One user failing leaves them for the next
 * run and does not stop the others.
 */
export async function runPurge(ctx: JobContext): Promise<void> {
  const due = await prisma.user.findMany({
    where: { deletionScheduledFor: { lte: ctx.now } },
    select: { id: true },
  });
  if (due.length === 0) return;

  const backup = backupStore();
  let purged = 0;
  for (const { id: userId } of due) {
    if (ctx.shouldStop()) break;
    try {
      if (storageConfigured) await deleteUserObjects(userId);
      if (backup) {
        const uploads = await prisma.upload.findMany({
          where: { userId },
          select: { storageKey: true },
        });
        for (const upload of uploads) {
          await backup.deleteObject(`${PHOTO_PREFIX}${upload.storageKey}`);
        }
      }
      await prisma.user.delete({ where: { id: userId } });
      purged += 1;
    } catch (error) {
      logger.error(
        { err: error, task: 'purge', userId },
        'purge failed for a user; retrying next run',
      );
    }
  }
  logger.info({ task: 'purge', due: due.length, purged }, 'purge finished');
}

registerTask({ name: 'purge', everyMs: 60 * 60 * 1000, run: runPurge });
