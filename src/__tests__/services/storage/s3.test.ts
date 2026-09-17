import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class Command<T> {
    constructor(readonly input: T) {}
  }
  return {
    S3Client: vi.fn(function (this: { send: typeof send }) {
      this.send = send;
    }),
    PutObjectCommand: class extends Command<Record<string, unknown>> {},
    GetObjectCommand: class extends Command<Record<string, unknown>> {},
    DeleteObjectCommand: class extends Command<Record<string, unknown>> {},
    ListObjectsV2Command: class extends Command<Record<string, unknown>> {},
    HeadObjectCommand: class extends Command<Record<string, unknown>> {},
  };
});

vi.mock('@/lib/env', () => ({
  env: {
    S3_ENDPOINT: 'https://ref.storage.supabase.co/storage/v1/s3',
    S3_REGION: 'eu-central-1',
    S3_BUCKET: 'dietyaar',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_KEY_PREFIX: 'staging/',
    BACKUP_S3_ENDPOINT: undefined,
    BACKUP_S3_REGION: undefined,
    BACKUP_S3_BUCKET: undefined,
    BACKUP_S3_ACCESS_KEY_ID: undefined,
    BACKUP_S3_SECRET_ACCESS_KEY: undefined,
  },
  storageConfigured: true,
}));

import { S3Client } from '@aws-sdk/client-s3';
import {
  createStorage,
  resetStorageClients,
  storageTargetConfigured,
  uploadKey,
  userPrefix,
} from '@/services/storage/s3';

const lastInput = () => (send.mock.calls.at(-1)?.[0] as { input: Record<string, unknown> }).input;

beforeEach(() => {
  send.mockReset();
  resetStorageClients();
  vi.mocked(S3Client).mockClear();
});

describe('keys', () => {
  it('builds prefixed user keys', () => {
    expect(userPrefix('u1')).toBe('staging/uploads/u1/');
    expect(uploadKey('u1', 'up1')).toBe('staging/uploads/u1/up1.jpg');
  });
});

describe('createStorage', () => {
  it('throws STORAGE_UNAVAILABLE for an unconfigured target', () => {
    expect(storageTargetConfigured('backup')).toBe(false);
    expect(() => createStorage('backup')).toThrow(
      expect.objectContaining({ code: 'STORAGE_UNAVAILABLE' }),
    );
  });

  it('configures a path-style client once per target', () => {
    createStorage('photos');
    createStorage('photos');
    expect(S3Client).toHaveBeenCalledTimes(1);
    expect(vi.mocked(S3Client).mock.calls[0]?.[0]).toMatchObject({
      endpoint: 'https://ref.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
    });
  });

  it('puts a buffer with its content type and length', async () => {
    send.mockResolvedValue({});
    await createStorage('photos').putObject('k', Buffer.from('abc'), { contentType: 'image/jpeg' });
    expect(lastInput()).toMatchObject({
      Bucket: 'dietyaar',
      Key: 'k',
      ContentType: 'image/jpeg',
      ContentLength: 3,
    });
  });

  it('puts a stream with the given length', async () => {
    send.mockResolvedValue({});
    const body = Readable.from([Buffer.from('abc')]);
    await createStorage('photos').putObject('k', body, { contentLength: 3 });
    expect(lastInput()).toMatchObject({ Body: body, ContentLength: 3 });
  });

  it('reads an object into a buffer and streams it', async () => {
    const stream = Object.assign(Readable.from([Buffer.from('jpeg')]), {
      transformToByteArray: async () => new Uint8Array([1, 2, 3]),
    });
    send.mockResolvedValue({ Body: stream });
    const storage = createStorage('photos');
    expect(await storage.getObject('k')).toEqual(Buffer.from([1, 2, 3]));
    expect(await storage.getObjectStream('k')).toBe(stream);
  });

  it('maps a missing object to NOT_FOUND and null on head', async () => {
    send.mockRejectedValue(Object.assign(new Error('nope'), { name: 'NoSuchKey' }));
    const storage = createStorage('photos');
    await expect(storage.getObject('k')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(storage.headObject('k')).resolves.toBeNull();
  });

  it('lists keys across continuation tokens', async () => {
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'a' }, { Key: 'b' }],
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'c' }], IsTruncated: false });
    expect(await createStorage('photos').listKeys('staging/uploads/u1/')).toEqual(['a', 'b', 'c']);
    expect((send.mock.calls[1]?.[0] as { input: Record<string, unknown> }).input).toMatchObject({
      Prefix: 'staging/uploads/u1/',
      ContinuationToken: 'next',
    });
  });

  it('deletes and heads objects', async () => {
    send.mockResolvedValue({ ContentLength: 42, ContentType: 'image/jpeg' });
    const storage = createStorage('photos');
    await storage.deleteObject('k');
    expect(lastInput()).toEqual({ Bucket: 'dietyaar', Key: 'k' });
    expect(await storage.headObject('k')).toEqual({ size: 42, contentType: 'image/jpeg' });
  });
});
