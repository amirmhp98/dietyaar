/**
 * Operator backup (tech spec § 13, runbook "Backups"): the same pipeline the
 * nightly task runs, started by hand before a destructive migration or for the
 * restore rehearsal. Run it from a developer machine with the production env,
 * or from the Darkube terminal (the image has `pg_dump`):
 *
 *   npm run db:backup                                   # reads .env
 *   DOTENV_CONFIG_PATH=.env.production.local npm run db:backup
 *
 * Needs `pg_dump`, `gzip` and `openssl` on PATH, `DIRECT_DATABASE_URL`,
 * `BACKUP_S3_*` and `BACKUP_ENCRYPTION_KEY`. Exits 1 when the backup fails.
 * The npm script passes `--conditions=react-server` so `server-only` modules
 * load outside Next.js.
 */
import { config } from 'dotenv';

config({ path: process.env.DOTENV_CONFIG_PATH ?? '.env' });

async function main(): Promise<number> {
  // Imported after dotenv so `src/lib/env.ts` validates the loaded values.
  const { runBackupNow } = await import('@/services/jobs/backup.job');
  const { prisma } = await import('@/lib/prisma');
  try {
    const result = await runBackupNow(new Date());
    if (!result) {
      console.error('Backup not run: set BACKUP_S3_* and BACKUP_ENCRYPTION_KEY.');
      return 1;
    }
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
