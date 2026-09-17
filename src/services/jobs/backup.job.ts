import { env, storageConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { createStorage, storageTargetConfigured } from '@/services/storage/s3';
import {
  pgDumpEncrypted,
  runBackup,
  type BackupResult,
  type ObjectStore,
} from '@/services/jobs/backup-core';
import { registerTask, type JobContext } from '@/services/jobs/registry';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Hamravesh backup bucket, or `null` when `BACKUP_S3_*` is not set. */
export function backupStore(): ObjectStore | null {
  return storageTargetConfigured('backup') ? createStorage('backup') : null;
}

/**
 * One backup run with the production wiring (tech spec § 12
 * `backupToHamravesh`): photos first, then the encrypted `pg_dump`, then
 * age-based retention. Returns `null` when the bucket or the key is missing.
 * `runBackup` never throws; a failure is one `backup_failed` log line (the
 * § 16 metric). Shared by the nightly task and `scripts/db-backup.ts`.
 */
export async function runBackupNow(
  now: Date,
  shouldStop: () => boolean = () => false,
): Promise<BackupResult | null> {
  const backup = backupStore();
  if (!backup) {
    logger.warn({ task: 'backup' }, 'backup skipped: BACKUP_S3_* is not configured');
    return null;
  }
  if (!env.BACKUP_ENCRYPTION_KEY) {
    logger.error(
      { task: 'backup', event: 'backup_failed', reason: 'BACKUP_ENCRYPTION_KEY is not set' },
      'backup failed',
    );
    return null;
  }

  return runBackup({
    backup,
    photos: storageConfigured ? createStorage('photos') : null,
    listAttached: () =>
      prisma.upload
        .findMany({ where: { status: 'ATTACHED' }, select: { storageKey: true } })
        .then((uploads) => uploads.map((upload) => ({ key: upload.storageKey }))),
    dump: pgDumpEncrypted({
      databaseUrl: env.DIRECT_DATABASE_URL,
      encryptionKey: env.BACKUP_ENCRYPTION_KEY,
    }),
    log: logger,
    now,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    shouldStop,
  });
}

export async function runBackupTask(ctx: JobContext): Promise<void> {
  if (!env.BACKUP_ENABLED) return;
  await runBackupNow(ctx.now, ctx.shouldStop);
}

registerTask({ name: 'backup', everyMs: DAY_MS, atUtcHour: 3, run: runBackupTask });
