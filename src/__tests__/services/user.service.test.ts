import { describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { userFactory } from '@/__tests__/factories';
import { ServiceError } from '@/lib/errors';
import {
  createUser,
  listUsers,
  resetPassword,
  setUserActive,
  updateUser,
} from '@/services/user.service';

resetPrismaMock();

const ADMIN_ID = 'admin-1';

describe('listUsers', () => {
  it('returns users newest first without password hashes', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await listUsers();
    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual({ createdAt: 'desc' });
    expect(args?.select).not.toHaveProperty('passwordHash');
  });
});

describe('createUser', () => {
  const input = {
    username: 'newbie',
    password: 'longenough',
    fullName: 'تازه وارد',
    role: 'USER' as const,
  };

  it('hashes the password and stores the user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(userFactory.build({ username: 'newbie' }));

    await createUser(input);

    const data = prismaMock.user.create.mock.calls[0]?.[0]?.data;
    expect(data?.username).toBe('newbie');
    expect(data?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data?.passwordHash).not.toBe('longenough');
  });

  it('rejects a taken username with a ServiceError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ username: 'newbie' }));

    await expect(createUser(input)).rejects.toMatchObject({
      name: 'ServiceError',
      code: 'USERNAME_TAKEN',
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe('updateUser', () => {
  it('updates name and role for another user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ id: 'u-2' }));
    prismaMock.user.update.mockResolvedValue(userFactory.build({ id: 'u-2' }));

    await updateUser('u-2', { fullName: 'نام جدید', role: 'ADMIN' }, ADMIN_ID);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-2' },
        data: { fullName: 'نام جدید', role: 'ADMIN' },
      }),
    );
  });

  it('refuses to change the acting admin’s own role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userFactory.build({ id: ADMIN_ID, role: 'ADMIN' }),
    );

    await expect(
      updateUser(ADMIN_ID, { fullName: 'x', role: 'USER' }, ADMIN_ID),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows the admin to change their own name when the role is unchanged', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userFactory.build({ id: ADMIN_ID, role: 'ADMIN' }),
    );
    prismaMock.user.update.mockResolvedValue(userFactory.build({ id: ADMIN_ID }));

    await expect(
      updateUser(ADMIN_ID, { fullName: 'نام تازه', role: 'ADMIN' }, ADMIN_ID),
    ).resolves.toBeDefined();
  });

  it('throws USER_NOT_FOUND for an unknown id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(
      updateUser('nope', { fullName: 'x', role: 'USER' }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});

describe('setUserActive', () => {
  it('deactivating revokes every session of that user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ id: 'u-2' }));
    prismaMock.user.update.mockResolvedValue(userFactory.build({ id: 'u-2', isActive: false }));
    prismaMock.session.deleteMany.mockResolvedValue({ count: 2 });

    await setUserActive('u-2', false, ADMIN_ID);

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-2' } });
  });

  it('activating does not touch sessions', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ id: 'u-2', isActive: false }));
    prismaMock.user.update.mockResolvedValue(userFactory.build({ id: 'u-2' }));

    await setUserActive('u-2', true, ADMIN_ID);

    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses self-deactivation before hitting the database', async () => {
    await expect(setUserActive(ADMIN_ID, false, ADMIN_ID)).rejects.toMatchObject({
      code: 'SELF_DEACTIVATE',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  it('stores a new hash and revokes sessions', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ id: 'u-2' }));
    prismaMock.user.update.mockResolvedValue(userFactory.build({ id: 'u-2' }));
    prismaMock.session.deleteMany.mockResolvedValue({ count: 1 });

    await resetPassword('u-2', 'brand-new-secret');

    const data = prismaMock.user.update.mock.calls[0]?.[0]?.data;
    expect(data?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-2' } });
  });
});
