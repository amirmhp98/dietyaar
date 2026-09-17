/**
 * Backup pipeline (tech spec § 12 `backupToHamravesh`, decision 018), kept
 * free of Next.js, Prisma and the validated env so both the nightly task
 * (`backup.job.ts`) and the operator script (`scripts/db-backup.ts`) run it.
 *
 * Order matters: photos first, then the database dump, so a dump never
 * references an object the backup bucket does not have yet.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DB_PREFIX = 'db/';
export const PHOTO_PREFIX = 'photos/';
const DUMP_KEY = /^db\/(\d{4}-\d{2}-\d{2})\.dump\.gz\.enc$/;

/**
 * The slice of `services/storage/s3` the pipeline needs. Photos travel as
 * Buffers (under 1 MB each); the dump streams from its temp file.
 */
export interface PutOptions {
  contentType?: string;
  contentLength?: number;
}

export interface ObjectStore {
  listKeys(prefix: string): Promise<string[]>;
  putObject(key: string, body: Buffer | Readable, options?: PutOptions): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export interface ObjectSource {
  getObject(key: string): Promise<Buffer>;
}

export const DUMP_CONTENT_TYPE = 'application/octet-stream';
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

export interface BackupLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface AttachedObject {
  key: string;
}

export interface DumpTarget {
  /** Where the encrypted dump is written before upload. */
  filePath: string;
}

export interface BackupDeps {
  backup: ObjectStore;
  /** `null` when the photo bucket is not configured: the photo step is skipped. */
  photos: ObjectSource | null;
  /** Every `ATTACHED` upload's photo-bucket key (`Upload.storageKey`). */
  listAttached(): Promise<AttachedObject[]>;
  /** Produces the encrypted dump at `target.filePath`; the default runs pg_dump | gzip | openssl. */
  dump(target: DumpTarget): Promise<void>;
  log: BackupLogger;
  now: Date;
  retentionDays: number;
  shouldStop?: () => boolean;
}

export interface BackupResult {
  ok: boolean;
  photosCopied: number;
  dumpKey: string | null;
  dumpBytes: number;
  dumpsDeleted: string[];
  durationMs: number;
  stopped: boolean;
}

/** `db/2026-09-17.dump.gz.enc` for the given instant (UTC date). */
export function dumpKeyFor(now: Date): string {
  return `${DB_PREFIX}${now.toISOString().slice(0, 10)}.dump.gz.enc`;
}

/**
 * Dump keys to delete: older than `retentionDays` by their date, never the
 * newest one. Keys that do not match the naming scheme are left alone.
 */
export function dumpsToDelete(keys: string[], now: Date, retentionDays: number): string[] {
  const dated = keys
    .map((key) => {
      const match = DUMP_KEY.exec(key);
      return match ? { key, date: match[1] } : null;
    })
    .filter((entry): entry is { key: string; date: string } => entry !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length === 0) return [];
  const newest = dated[dated.length - 1].key;
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString().slice(0, 10);
  return dated.filter((entry) => entry.key !== newest && entry.date < cutoff).map((e) => e.key);
}

/**
 * libpq rejects the Prisma-only query parameters (`schema`, `pgbouncer`,
 * `connection_limit`, ...); strip them before handing the URL to pg_dump.
 */
export function pgConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  for (const param of [
    'schema',
    'pgbouncer',
    'connection_limit',
    'pool_timeout',
    'socket_timeout',
    'statement_cache_size',
  ]) {
    url.searchParams.delete(param);
  }
  return url.toString();
}

export interface PgDumpOptions {
  databaseUrl: string;
  encryptionKey: string;
  /** Overridable for tests; defaults to the real binaries on PATH. */
  commands?: { pgDump: string; gzip: string; openssl: string };
}

/**
 * `pg_dump --format=custom | gzip | openssl enc -aes-256-cbc -pbkdf2` into a
 * file. Each process must exit 0; the passphrase travels through the
 * environment (`-pass env:BACKUP_ENCRYPTION_KEY`), never through argv.
 * `turbopackIgnore` stops `next build` from tracing the whole repository
 * because the command names are not string literals.
 */
export function pgDumpEncrypted(options: PgDumpOptions): (target: DumpTarget) => Promise<void> {
  const commands = options.commands ?? { pgDump: 'pg_dump', gzip: 'gzip', openssl: 'openssl' };
  return (target) =>
    new Promise<void>((resolve, reject) => {
      const stderr: string[] = [];
      const pgDump = spawn(
        /* turbopackIgnore: true */
        commands.pgDump,
        [
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          pgConnectionString(options.databaseUrl),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const gzip = spawn(/* turbopackIgnore: true */ commands.gzip, ['-c'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const openssl = spawn(
        /* turbopackIgnore: true */
        commands.openssl,
        ['enc', '-aes-256-cbc', '-pbkdf2', '-pass', 'env:BACKUP_ENCRYPTION_KEY'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, BACKUP_ENCRYPTION_KEY: options.encryptionKey },
        },
      );
      const out = createWriteStream(target.filePath);

      pgDump.stdout.pipe(gzip.stdin);
      gzip.stdout.pipe(openssl.stdin);
      openssl.stdout.pipe(out);
      // A stage that dies early closes its stdin; the writer then sees EPIPE.
      // The non-zero exit code already reports the failure, so swallow it here.
      for (const pipe of [gzip.stdin, openssl.stdin]) pipe.on('error', () => {});

      let failed = false;
      const fail = (error: Error) => {
        if (failed) return;
        failed = true;
        for (const child of [pgDump, gzip, openssl]) child.kill();
        reject(error);
      };

      const processes: [string, ChildProcess][] = [
        ['pg_dump', pgDump],
        ['gzip', gzip],
        ['openssl', openssl],
      ];
      let remaining = processes.length + 1; // the three processes plus the file stream
      const done = () => {
        remaining -= 1;
        if (remaining === 0 && !failed) resolve();
      };
      for (const [name, child] of processes) {
        child.stderr?.on('data', (chunk: Buffer) => stderr.push(`${name}: ${chunk.toString()}`));
        child.on('error', (error) => fail(new Error(`${name} could not start: ${error.message}`)));
        child.on('close', (code) => {
          if (code === 0) done();
          else fail(new Error(`${name} exited with ${code}. ${stderr.join('').trim()}`));
        });
      }
      out.on('error', fail);
      out.on('finish', done);
    });
}

/** Copies every attached photo the backup bucket does not have yet to `photos/{key}`. */
async function copyNewPhotos(deps: BackupDeps): Promise<{ copied: number; stopped: boolean }> {
  if (!deps.photos) return { copied: 0, stopped: false };
  const present = new Set(await deps.backup.listKeys(PHOTO_PREFIX));
  const missing = (await deps.listAttached()).filter(
    (object) => !present.has(`${PHOTO_PREFIX}${object.key}`),
  );
  let copied = 0;
  for (const object of missing) {
    if (deps.shouldStop?.()) return { copied, stopped: true };
    const body = await deps.photos.getObject(object.key);
    await deps.backup.putObject(`${PHOTO_PREFIX}${object.key}`, body, {
      contentType: PHOTO_CONTENT_TYPE,
    });
    copied += 1;
  }
  return { copied, stopped: false };
}

/**
 * Runs the whole nightly pipeline and never throws: a failure is logged as
 * one `backup_failed` line (the § 16 metric) and reported in the result. The
 * temp directory is always removed.
 */
export async function runBackup(deps: BackupDeps): Promise<BackupResult> {
  const startedAt = Date.now();
  const result: BackupResult = {
    ok: false,
    photosCopied: 0,
    dumpKey: null,
    dumpBytes: 0,
    dumpsDeleted: [],
    durationMs: 0,
    stopped: false,
  };
  try {
    const photos = await copyNewPhotos(deps);
    result.photosCopied = photos.copied;
    if (photos.stopped || deps.shouldStop?.()) {
      result.stopped = true;
      result.durationMs = Date.now() - startedAt;
      deps.log.warn({ task: 'backup', ...result }, 'backup stopped before the database dump');
      return result;
    }

    const dir = await mkdtemp(join(tmpdir(), 'dietyaar-backup-'));
    try {
      const filePath = join(dir, 'db.dump.gz.enc');
      await deps.dump({ filePath });
      const { size } = await stat(filePath);
      if (size === 0) throw new Error('pg_dump produced an empty file');
      const key = dumpKeyFor(deps.now);
      await deps.backup.putObject(key, createReadStream(filePath), {
        contentType: DUMP_CONTENT_TYPE,
        contentLength: size,
      });
      result.dumpKey = key;
      result.dumpBytes = size;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const existing = await deps.backup.listKeys(DB_PREFIX);
    const known = existing.includes(result.dumpKey) ? existing : [...existing, result.dumpKey];
    for (const key of dumpsToDelete(known, deps.now, deps.retentionDays)) {
      await deps.backup.deleteObject(key);
      result.dumpsDeleted.push(key);
    }

    result.ok = true;
    result.durationMs = Date.now() - startedAt;
    deps.log.info({ task: 'backup', ...result }, 'backup finished');
  } catch (error) {
    result.durationMs = Date.now() - startedAt;
    deps.log.error(
      { err: error, task: 'backup', event: 'backup_failed', ...result },
      'backup failed',
    );
  }
  return result;
}
