import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  dumpKeyFor,
  dumpsToDelete,
  pgConnectionString,
  pgDumpEncrypted,
  runBackup,
  type BackupDeps,
  type ObjectStore,
  type PutOptions,
} from '@/services/jobs/backup-core';

const now = new Date('2026-09-17T03:00:00Z');

/** In-memory bucket that records every call in order. */
function fakeStore(initialKeys: string[] = []) {
  const objects = new Map<string, { body: Buffer; options?: PutOptions }>(
    initialKeys.map((key) => [key, { body: Buffer.alloc(0) }]),
  );
  const calls: string[] = [];
  const store: ObjectStore = {
    listKeys: async (prefix) => {
      calls.push(`list ${prefix}`);
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
    putObject: async (key, body, options) => {
      calls.push(`put ${key}`);
      const chunks: Buffer[] = [];
      if (body instanceof Readable) for await (const chunk of body) chunks.push(chunk as Buffer);
      objects.set(key, { body: body instanceof Readable ? Buffer.concat(chunks) : body, options });
    },
    deleteObject: async (key) => {
      calls.push(`delete ${key}`);
      objects.delete(key);
    },
  };
  return { store, calls, objects };
}

const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

function deps(overrides: Partial<BackupDeps> = {}): BackupDeps {
  return {
    backup: fakeStore().store,
    photos: null,
    listAttached: async () => [],
    dump: async ({ filePath }) => {
      await writeFile(filePath, 'encrypted-dump');
    },
    log: log(),
    now,
    retentionDays: 30,
    ...overrides,
  };
}

describe('dumpsToDelete', () => {
  it('deletes dumps older than the retention window but always keeps the newest', () => {
    const keys = [
      'db/2026-07-01.dump.gz.enc',
      'db/2026-08-01.dump.gz.enc',
      'db/2026-09-16.dump.gz.enc',
      'db/2026-09-17.dump.gz.enc',
      'db/notes.txt',
    ];
    expect(dumpsToDelete(keys, now, 30)).toEqual([
      'db/2026-07-01.dump.gz.enc',
      'db/2026-08-01.dump.gz.enc',
    ]);
  });

  it('keeps the newest dump even when it is older than the window', () => {
    expect(dumpsToDelete(['db/2026-01-01.dump.gz.enc'], now, 30)).toEqual([]);
    expect(
      dumpsToDelete(['db/2026-01-01.dump.gz.enc', 'db/2026-02-01.dump.gz.enc'], now, 30),
    ).toEqual(['db/2026-01-01.dump.gz.enc']);
  });

  it('names the dump after the UTC date', () => {
    expect(dumpKeyFor(new Date('2026-09-17T23:30:00-05:00'))).toBe('db/2026-09-18.dump.gz.enc');
  });
});

describe('pgConnectionString', () => {
  it('drops the Prisma-only query parameters and keeps libpq ones', () => {
    expect(
      pgConnectionString(
        'postgresql://u:p@host:5432/app?schema=public&pgbouncer=true&connection_limit=5&sslmode=require',
      ),
    ).toBe('postgresql://u:p@host:5432/app?sslmode=require');
  });
});

describe('runBackup', () => {
  it('copies missing attached photos before dumping, uploads the dump and prunes old dumps', async () => {
    const bucket = fakeStore([
      'photos/uploads/u1/old.jpg',
      'db/2026-07-01.dump.gz.enc',
      'db/2026-09-16.dump.gz.enc',
    ]);
    const photos = { getObject: vi.fn(async () => Buffer.from('jpeg')) };
    const logger = log();
    const result = await runBackup(
      deps({
        backup: bucket.store,
        photos,
        listAttached: async () => [{ key: 'uploads/u1/old.jpg' }, { key: 'uploads/u1/new.jpg' }],
        log: logger,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      photosCopied: 1,
      dumpKey: 'db/2026-09-17.dump.gz.enc',
      dumpBytes: 'encrypted-dump'.length,
      dumpsDeleted: ['db/2026-07-01.dump.gz.enc'],
      stopped: false,
    });
    expect(photos.getObject).toHaveBeenCalledWith('uploads/u1/new.jpg');
    expect(bucket.calls).toEqual([
      'list photos/',
      'put photos/uploads/u1/new.jpg',
      'put db/2026-09-17.dump.gz.enc',
      'list db/',
      'delete db/2026-07-01.dump.gz.enc',
    ]);
    expect(bucket.objects.get('photos/uploads/u1/new.jpg')).toEqual({
      body: Buffer.from('jpeg'),
      options: { contentType: 'image/jpeg' },
    });
    expect(bucket.objects.get('db/2026-09-17.dump.gz.enc')).toEqual({
      body: Buffer.from('encrypted-dump'),
      options: { contentType: 'application/octet-stream', contentLength: 14 },
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ task: 'backup', dumpBytes: 14 }),
      'backup finished',
    );
  });

  it('skips the photo step when the photo bucket is not configured', async () => {
    const bucket = fakeStore();
    const listAttached = vi.fn(async () => [{ key: 'uploads/u1/a.jpg' }]);
    const result = await runBackup(deps({ backup: bucket.store, photos: null, listAttached }));
    expect(result.ok).toBe(true);
    expect(listAttached).not.toHaveBeenCalled();
    expect(bucket.calls[0]).toBe('put db/2026-09-17.dump.gz.enc');
  });

  it('logs backup_failed and never throws when the dump fails', async () => {
    const bucket = fakeStore();
    const logger = log();
    const result = await runBackup(
      deps({
        backup: bucket.store,
        dump: async () => {
          throw new Error('pg_dump exited with 1');
        },
        log: logger,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.dumpKey).toBeNull();
    expect(bucket.calls).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'backup_failed', err: expect.any(Error) }),
      'backup failed',
    );
  });

  it('treats an empty dump file as a failure', async () => {
    const logger = log();
    const result = await runBackup(
      deps({
        dump: async ({ filePath }) => {
          await writeFile(filePath, '');
        },
        log: logger,
      }),
    );
    expect(result.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'backup_failed' }),
      'backup failed',
    );
  });

  it('stops between photos when the lease is lost and does not dump', async () => {
    const bucket = fakeStore();
    const dump = vi.fn(async () => {});
    let checks = 0;
    const result = await runBackup(
      deps({
        backup: bucket.store,
        photos: { getObject: async () => Buffer.from('x') },
        listAttached: async () => [{ key: 'a.jpg' }, { key: 'b.jpg' }],
        dump,
        shouldStop: () => ++checks > 1,
      }),
    );
    expect(result).toMatchObject({ ok: false, stopped: true, photosCopied: 1, dumpKey: null });
    expect(dump).not.toHaveBeenCalled();
  });
});

describe('pgDumpEncrypted', () => {
  /** Tiny stand-ins: `pg_dump` echoes its arguments, the filters pass bytes through. */
  async function stubCommands(dir: string, pgDump = 'echo "$@"') {
    const { writeFile, chmod } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const commands = {
      pgDump: join(dir, 'pg_dump'),
      gzip: join(dir, 'gzip'),
      openssl: join(dir, 'openssl'),
    };
    await writeFile(commands.pgDump, `#!/bin/sh\n${pgDump}\n`);
    await writeFile(commands.gzip, '#!/bin/sh\ncat\n');
    await writeFile(
      commands.openssl,
      '#!/bin/sh\ntest "$BACKUP_ENCRYPTION_KEY" = secret || exit 9\ncat\n',
    );
    for (const file of Object.values(commands)) await chmod(file, 0o755);
    return commands;
  }

  async function inTempDir(run: (dir: string) => Promise<void>) {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'backup-test-'));
    try {
      await run(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it('pipes pg_dump through gzip and openssl into the target file with the key in the environment', async () => {
    await inTempDir(async (dir) => {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const dump = pgDumpEncrypted({
        databaseUrl: 'postgresql://u:p@localhost:5432/app?schema=public',
        encryptionKey: 'secret',
        commands: await stubCommands(dir),
      });
      const filePath = join(dir, 'out');
      await dump({ filePath });
      // The sanitized connection string reached pg_dump; the bytes reached the file.
      expect(await readFile(filePath, 'utf8')).toBe(
        '--format=custom --no-owner --no-privileges postgresql://u:p@localhost:5432/app\n',
      );
    });
  });

  it('rejects when a stage exits non-zero', async () => {
    await inTempDir(async (dir) => {
      const { join } = await import('node:path');
      const dump = pgDumpEncrypted({
        databaseUrl: 'postgresql://u:p@localhost:5432/app',
        encryptionKey: 'secret',
        commands: await stubCommands(dir, 'echo "connection refused" >&2; exit 1'),
      });
      await expect(dump({ filePath: join(dir, 'out') })).rejects.toThrow(
        /pg_dump exited with 1\. pg_dump: connection refused/,
      );
    });
  });
});
