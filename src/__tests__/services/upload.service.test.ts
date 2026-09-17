import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { uploadFactory } from '@/__tests__/factories';

const storage = {
  putObject: vi.fn(),
  getObject: vi.fn(),
  getObjectStream: vi.fn(),
  deleteObject: vi.fn(),
  listKeys: vi.fn(),
  headObject: vi.fn(),
};

vi.mock('@/services/storage/s3', () => ({
  createStorage: vi.fn(() => storage),
  userPrefix: (userId: string) => `uploads/${userId}/`,
  uploadKey: (userId: string, id: string) => `uploads/${userId}/${id}.jpg`,
}));

vi.mock('@/lib/env', () => ({
  env: { STORAGE_SOFT_LIMIT_BYTES: 1_000_000 },
  storageConfigured: true,
}));

import {
  attachUploads,
  deleteStagedUpload,
  deleteUploadsForDrafts,
  deleteUserObjects,
  expireStagedUploads,
  getUploadForView,
  readStagedImages,
  removeUpload,
  stageUpload,
  storageUsageBytes,
} from '@/services/upload.service';

resetPrismaMock();
beforeEach(() => {
  for (const fn of Object.values(storage)) fn.mockReset();
});

const now = new Date('2026-09-17T10:00:00Z');
const input = {
  id: 'up1',
  bytes: 200_000,
  width: 1280,
  height: 960,
  sha256: 'a'.repeat(64),
  storageKey: 'uploads/u1/up1.jpg',
};

describe('stageUpload', () => {
  it('refuses STORAGE_FULL when the gauge plus the new bytes passes the soft limit', async () => {
    prismaMock.upload.aggregate.mockResolvedValue({ _sum: { bytes: 900_000 } } as never);
    await expect(stageUpload('u1', input, now)).rejects.toMatchObject({ code: 'STORAGE_FULL' });
    expect(prismaMock.upload.create).not.toHaveBeenCalled();
  });

  it('creates a STAGED row expiring in 24 h', async () => {
    prismaMock.upload.aggregate.mockResolvedValue({ _sum: { bytes: null } } as never);
    prismaMock.upload.create.mockResolvedValue(uploadFactory.build({ id: 'up1' }));
    const result = await stageUpload('u1', input, now);
    expect(prismaMock.upload.create.mock.calls[0]?.[0].data).toMatchObject({
      id: 'up1',
      userId: 'u1',
      status: 'STAGED',
      expiresAt: new Date('2026-09-18T10:00:00Z'),
    });
    expect(result.expiresAt).toEqual(new Date('2026-09-18T10:00:00Z'));
    expect(prismaMock.upload.aggregate.mock.calls[0]?.[0]?.where).toEqual({
      status: { not: 'REMOVED' },
    });
  });

  it('sums live uploads only', async () => {
    prismaMock.upload.aggregate.mockResolvedValue({ _sum: { bytes: 5 } } as never);
    expect(await storageUsageBytes()).toBe(5);
  });
});

describe('attachUploads', () => {
  it('attaches in order and fails on a foreign or already attached id', async () => {
    const tx = { upload: { updateMany: vi.fn() } };
    tx.upload.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(attachUploads(tx as never, 'u1', 'm1', ['a', 'b'])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(tx.upload.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'a', userId: 'u1', status: 'STAGED' },
      data: { status: 'ATTACHED', mealId: 'm1', position: 0, expiresAt: null },
    });
  });
});

describe('owner checks', () => {
  it('removeUpload: object first, row kept as REMOVED; foreign id is NOT_FOUND', async () => {
    prismaMock.upload.findFirst.mockResolvedValue(null);
    await expect(removeUpload('u2', 'up1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prismaMock.upload.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'up1',
      userId: 'u2',
    });

    prismaMock.upload.findFirst.mockResolvedValue(
      uploadFactory.build({ id: 'up1', storageKey: 'uploads/u1/up1.jpg' }),
    );
    await removeUpload('u1', 'up1');
    expect(storage.deleteObject).toHaveBeenCalledWith('uploads/u1/up1.jpg');
    expect(prismaMock.upload.update.mock.calls[0]?.[0].data).toMatchObject({ status: 'REMOVED' });
    expect(prismaMock.upload.delete).not.toHaveBeenCalled();
  });

  it('deleteStagedUpload: staged only, object then row', async () => {
    prismaMock.upload.findFirst.mockResolvedValue(uploadFactory.build({ id: 'up1' }));
    await deleteStagedUpload('u1', 'up1');
    expect(prismaMock.upload.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      status: 'STAGED',
      userId: 'u1',
    });
    expect(storage.deleteObject).toHaveBeenCalledBefore(prismaMock.upload.delete);
    expect(prismaMock.upload.delete).toHaveBeenCalledWith({ where: { id: 'up1' } });
  });

  it('readStagedImages returns buffers in the asked order and refuses foreign ids', async () => {
    prismaMock.upload.findMany.mockResolvedValue([
      uploadFactory.build({ id: 'b', storageKey: 'kb' }),
      uploadFactory.build({ id: 'a', storageKey: 'ka' }),
    ]);
    storage.getObject.mockImplementation(async (key: string) => Buffer.from(key));
    expect(await readStagedImages('u1', ['a', 'b'])).toEqual([
      Buffer.from('ka'),
      Buffer.from('kb'),
    ]);

    prismaMock.upload.findMany.mockResolvedValue([uploadFactory.build({ id: 'a' })]);
    await expect(readStagedImages('u1', ['a', 'zz'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('getUploadForView scopes by owner and excludes REMOVED', async () => {
    prismaMock.upload.findFirst.mockResolvedValue(null);
    expect(await getUploadForView('u2', 'up1')).toBeNull();
    expect(prismaMock.upload.findFirst.mock.calls[0]?.[0]?.where).toEqual({
      id: 'up1',
      userId: 'u2',
      status: { not: 'REMOVED' },
    });
  });
});

describe('expiry', () => {
  it('expireStagedUploads deletes a batch, object first, and skips a row whose object fails', async () => {
    prismaMock.upload.findMany.mockResolvedValue([
      uploadFactory.build({ id: 'a', storageKey: 'ka' }),
      uploadFactory.build({ id: 'b', storageKey: 'kb' }),
    ]);
    storage.deleteObject.mockImplementation(async (key: string) => {
      if (key === 'kb') throw new Error('s3 down');
    });
    expect(await expireStagedUploads(now, 50)).toBe(1);
    expect(prismaMock.upload.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: 'STAGED', expiresAt: { lt: now } },
      take: 50,
    });
    expect(prismaMock.upload.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.upload.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
  });

  it('deleteUploadsForDrafts touches staged rows only', async () => {
    expect(await deleteUploadsForDrafts([])).toBe(0);
    prismaMock.upload.findMany.mockResolvedValue([uploadFactory.build({ id: 'a' })]);
    expect(await deleteUploadsForDrafts(['a', 'b'])).toBe(1);
    expect(prismaMock.upload.findMany.mock.calls[0]?.[0]?.where).toEqual({
      id: { in: ['a', 'b'] },
      status: 'STAGED',
    });
  });

  it('deleteUserObjects removes every key under the user prefix', async () => {
    storage.listKeys.mockResolvedValue(['uploads/u1/a.jpg', 'uploads/u1/b.jpg']);
    expect(await deleteUserObjects('u1')).toBe(2);
    expect(storage.listKeys).toHaveBeenCalledWith('uploads/u1/');
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });
});
