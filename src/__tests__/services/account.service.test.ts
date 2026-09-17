import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { userFactory } from '@/__tests__/factories';
import { ServiceError } from '@/lib/errors';
import { signUpSchema } from '@/lib/validations/account';
import {
  changePassword,
  deleteUnderageAccount,
  requestDeletion,
  signUp,
} from '@/services/account.service';

resetPrismaMock();

describe('signUp', () => {
  it('rejects a taken username case-insensitively', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ usernameLower: 'sara' }));
    await expect(signUp({ username: 'SARA', password: 'correct-horse-9' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { usernameLower: 'sara' },
      select: { id: true },
    });
  });

  it('rejects a common password before touching the database', async () => {
    await expect(signUp({ username: 'sara', password: 'password1' })).rejects.toMatchObject({
      code: 'PASSWORD_COMMON',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates the user with the lowered username, no name, at the AGE step, and opens a session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const created = userFactory.build({
      username: 'Sara_01',
      usernameLower: 'sara_01',
      onboardingStep: 'AGE',
    });
    prismaMock.user.create.mockResolvedValue(created);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await signUp({ username: 'Sara_01', password: 'correct-horse-9' });

    const data = prismaMock.user.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      username: 'Sara_01',
      usernameLower: 'sara_01',
      fullName: null,
      onboardingStep: 'AGE',
    });
    expect(data?.passwordHash).not.toContain('correct-horse-9');
    expect(result.user.onboardingStep).toBe('AGE');
    expect(result.token).toHaveLength(64);
  });
});

describe('password limits (TS-§21.17)', () => {
  it('rejects a 73-byte multibyte password and accepts 64 ASCII characters', () => {
    const multibyte = 'é'.repeat(36) + 'a'; // 36 × 2 bytes + 1 = 73 bytes, 37 chars
    expect(signUpSchema.safeParse({ username: 'sara', password: multibyte }).success).toBe(false);
    expect(signUpSchema.safeParse({ username: 'sara', password: 'a'.repeat(64) }).success).toBe(
      true,
    );
    expect(signUpSchema.safeParse({ username: 'sara', password: 'a'.repeat(65) }).success).toBe(
      false,
    );
    expect(signUpSchema.safeParse({ username: 'sa', password: 'a'.repeat(10) }).success).toBe(
      false,
    );
    expect(signUpSchema.safeParse({ username: 'sa-ra', password: 'a'.repeat(10) }).success).toBe(
      false,
    );
  });
});

describe('changePassword', () => {
  it('verifies the current password, stores a new hash and revokes other sessions', async () => {
    const passwordHash = await bcrypt.hash('old-password-1', 4);
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ id: 'u1', passwordHash }));
    await changePassword('u1', 'old-password-1', 'brand-new-pass-2', 'raw-token');
    expect(prismaMock.user.update).toHaveBeenCalled();
    const where = prismaMock.session.deleteMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ userId: 'u1' });
    expect(JSON.stringify(where)).not.toContain('raw-token');
  });

  it('refuses a wrong current password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userFactory.build({ passwordHash: await bcrypt.hash('x-y-z-1234', 4) }),
    );
    await expect(changePassword('u1', 'nope', 'brand-new-pass-2', 't')).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe('requestDeletion', () => {
  it('needs the typed username, then deactivates, schedules the purge, cancels jobs and revokes sessions', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userFactory.build({ id: 'u1', usernameLower: 'sara' }),
    );
    await expect(requestDeletion('u1', 'someone-else')).rejects.toMatchObject({
      code: 'CONFIRMATION_MISMATCH',
    });

    prismaMock.$transaction.mockResolvedValue([]);
    const now = new Date('2026-09-17T10:00:00Z');
    await requestDeletion('u1', ' Sara ', now);
    const update = prismaMock.user.update.mock.calls[0]?.[0];
    expect(update?.data).toMatchObject({ isActive: false, deletionRequestedAt: now });
    expect(
      (update?.data as { deletionScheduledFor: Date }).deletionScheduledFor.toISOString(),
    ).toBe('2026-09-24T10:00:00.000Z');
    expect(prismaMock.planImportJob.updateMany).toHaveBeenCalled();
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('deleteUnderageAccount (TS-§21.15)', () => {
  it('deletes the user row only while no profile exists and the step is AGE', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ id: 'u1', onboardingStep: 'AGE' }),
      profile: null,
    } as never);
    await deleteUnderageAccount('u1');
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });

    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ id: 'u1', onboardingStep: 'SEX' }),
      profile: { id: 'p' },
    } as never);
    await expect(deleteUnderageAccount('u1')).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
