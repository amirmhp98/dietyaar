import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { userFactory } from '@/__tests__/factories';

// The purge reads only `storageConfigured`; make it switchable per test.
const storageState = vi.hoisted(() => ({ configured: false }));
vi.mock('@/lib/env', () => ({
  env: { S3_KEY_PREFIX: '' },
  get storageConfigured() {
    return storageState.configured;
  },
}));

const deleteUserObjects = vi.hoisted(() => vi.fn<(userId: string) => Promise<void>>());
vi.mock('@/services/upload.service', () => ({ deleteUserObjects }));

const backupDeleteObject = vi.hoisted(() => vi.fn<(key: string) => Promise<void>>());
const backupState = vi.hoisted(() => ({ configured: false }));
vi.mock('@/services/jobs/backup.job', () => ({
  backupStore: () => (backupState.configured ? { deleteObject: backupDeleteObject } : null),
}));

import { runPurge } from '@/services/jobs/purge.job';

resetPrismaMock();
beforeEach(() => {
  deleteUserObjects.mockReset().mockResolvedValue();
  backupDeleteObject.mockReset().mockResolvedValue();
  storageState.configured = false;
  backupState.configured = false;
});

const now = new Date('2026-09-17T10:00:00Z');
const ctx = { now, shouldStop: () => false };

describe('runPurge', () => {
  it('selects users past deletionScheduledFor and deletes their rows', async () => {
    const user = userFactory.build({ deletionScheduledFor: new Date('2026-09-10T00:00:00Z') });
    prismaMock.user.findMany.mockResolvedValue([user]);
    prismaMock.user.delete.mockResolvedValue(user);

    await runPurge(ctx);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { deletionScheduledFor: { lte: now } },
      select: { id: true },
    });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: user.id } });
    // Neither bucket is configured: no storage calls at all.
    expect(deleteUserObjects).not.toHaveBeenCalled();
    expect(backupDeleteObject).not.toHaveBeenCalled();
    expect(prismaMock.upload.findMany).not.toHaveBeenCalled();
  });

  it('deletes photo objects, then backup copies, then the user when both buckets are configured', async () => {
    storageState.configured = true;
    backupState.configured = true;
    const user = userFactory.build();
    prismaMock.user.findMany.mockResolvedValue([user]);
    prismaMock.upload.findMany.mockResolvedValue([
      { storageKey: `uploads/${user.id}/a.jpg` },
      { storageKey: `uploads/${user.id}/b.jpg` },
    ] as never);
    prismaMock.user.delete.mockResolvedValue(user);

    const order: string[] = [];
    deleteUserObjects.mockImplementation(async () => {
      order.push('photos');
    });
    backupDeleteObject.mockImplementation(async (key) => {
      order.push(key);
    });
    prismaMock.user.delete.mockImplementation((() => {
      order.push('user');
      return Promise.resolve(user);
    }) as never);

    await runPurge(ctx);

    expect(deleteUserObjects).toHaveBeenCalledWith(user.id);
    expect(order).toEqual([
      'photos',
      `photos/uploads/${user.id}/a.jpg`,
      `photos/uploads/${user.id}/b.jpg`,
      'user',
    ]);
  });

  it('keeps going after one user fails and skips the rest once asked to stop', async () => {
    const failing = userFactory.build();
    const fine = userFactory.build();
    const later = userFactory.build();
    prismaMock.user.findMany.mockResolvedValue([failing, fine, later]);
    prismaMock.user.delete
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(fine)
      .mockResolvedValueOnce(later);

    let checks = 0;
    await runPurge({ now, shouldStop: () => ++checks > 2 });

    expect(prismaMock.user.delete).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.delete).toHaveBeenLastCalledWith({ where: { id: fine.id } });
  });

  it('does nothing when no account is due', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await runPurge(ctx);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
