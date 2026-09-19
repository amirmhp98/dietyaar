import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env, storageConfigured } from '@/lib/env';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { photo } from '@/messages/sections/photo';

/**
 * S3 adapter with two targets (tech spec § 13, decisions 016 and 018):
 * `photos` is the private Supabase bucket behind `S3_*`, `backup` the
 * Hamravesh bucket behind `BACKUP_S3_*`. `forcePathStyle` because Supabase's
 * S3 endpoint is path-based. Keys are built by `uploadKey` / `userPrefix` so
 * the prefix rule lives in one place.
 */

export type StorageTarget = 'photos' | 'backup';

export interface PutObjectOptions {
  contentType?: string;
  /** Required for a streamed body; derived from a Buffer. */
  contentLength?: number;
}

export interface Storage {
  putObject(key: string, body: Buffer | Readable, options?: PutObjectOptions): Promise<void>;
  /** Whole object in memory (photos are ≤ ~250 KB after the device pipeline). */
  getObject(key: string): Promise<Buffer>;
  /** Streamed body (Node `Readable`) for route responses, the export zip and backups. */
  getObjectStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  headObject(key: string): Promise<{ size: number; contentType: string | null } | null>;
}

// Pending `t()` migration: the photo section is not wired into en.ts yet.
const msg = (key: keyof typeof photo) => photo[key];

interface TargetConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function configFor(target: StorageTarget): TargetConfig | null {
  const c =
    target === 'photos'
      ? {
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : {
          endpoint: env.BACKUP_S3_ENDPOINT,
          region: env.BACKUP_S3_REGION,
          bucket: env.BACKUP_S3_BUCKET,
          accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
          secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
        };
  if (!c.endpoint || !c.region || !c.bucket || !c.accessKeyId || !c.secretAccessKey) return null;
  return c as TargetConfig;
}

/** True when the named target has every variable set. */
export function storageTargetConfigured(target: StorageTarget): boolean {
  return target === 'photos' ? storageConfigured : configFor('backup') !== null;
}

/** Object key of one upload: `{prefix}uploads/{userId}/{uploadId}.jpg`. */
export function uploadKey(userId: string, uploadId: string): string {
  return `${userPrefix(userId)}${uploadId}.jpg`;
}

/** Every object of one user lives under this prefix (purge deletes it wholesale). */
export function userPrefix(userId: string): string {
  return `${env.S3_KEY_PREFIX}uploads/${userId}/`;
}

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: string; $metadata?: { httpStatusCode?: number } })?.name;
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === 'NoSuchKey' || name === 'NotFound' || status === 404;
}

const clients = new Map<StorageTarget, S3Client>();

function clientFor(target: StorageTarget, config: TargetConfig): S3Client {
  let client = clients.get(target);
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    clients.set(target, client);
  }
  return client;
}

/** Test hook: drop cached clients so a new mock is picked up. */
export function resetStorageClients(): void {
  clients.clear();
}

/**
 * Best-effort delete of photo objects whose rows are already gone or
 * `REMOVED`: each failure is logged and the rest continue, so a storage
 * hiccup never blocks the record change that triggered it. Silently a no-op
 * when storage is not configured (dev without a bucket).
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0 || !storageConfigured) return;
  const storage = createStorage('photos');
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'photo object delete failed; left for the purge');
    }
  }
}

/**
 * Storage for one target. Throws `STORAGE_UNAVAILABLE` when its variables are
 * not set, so callers can offer the text path instead.
 */
export function createStorage(target: StorageTarget): Storage {
  const config = configFor(target);
  if (!config) {
    throw new ServiceError(msg('photo.errors.storageUnavailable'), 'STORAGE_UNAVAILABLE');
  }
  const client = clientFor(target, config);
  const Bucket = config.bucket;

  return {
    async putObject(key, body, options = {}) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          ContentLength: Buffer.isBuffer(body) ? body.byteLength : options.contentLength,
        }),
      );
    },

    async getObject(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!out.Body) throw new ServiceError(msg('photo.errors.notFound'), 'NOT_FOUND');
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (error) {
        if (isNotFound(error)) throw new ServiceError(msg('photo.errors.notFound'), 'NOT_FOUND');
        throw error;
      }
    },

    async getObjectStream(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!out.Body) throw new ServiceError(msg('photo.errors.notFound'), 'NOT_FOUND');
        return out.Body as unknown as Readable;
      } catch (error) {
        if (isNotFound(error)) throw new ServiceError(msg('photo.errors.notFound'), 'NOT_FOUND');
        throw error;
      }
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    async listKeys(prefix) {
      const keys: string[] = [];
      let ContinuationToken: string | undefined;
      do {
        const out = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }),
        );
        for (const item of out.Contents ?? []) if (item.Key) keys.push(item.Key);
        ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return keys;
    },

    async headObject(key) {
      try {
        const out = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: out.ContentLength ?? 0, contentType: out.ContentType ?? null };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };
}
