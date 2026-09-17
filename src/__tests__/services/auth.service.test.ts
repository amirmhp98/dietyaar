import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { userFactory, sessionFactory } from '@/__tests__/factories';
import {
  authenticate,
  findUserBySessionToken,
  hashSessionToken,
  revokeAllSessions,
  revokeSession,
} from '@/services/auth.service';

resetPrismaMock();

describe('hashSessionToken', () => {
  it('is deterministic and does not leak the raw token', () => {
    const hash = hashSessionToken('raw-token');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashSessionToken('raw-token'));
    expect(hash).not.toContain('raw-token');
  });
});

describe('authenticate', () => {
  it('returns a session for valid credentials and persists only the hash', async () => {
    const passwordHash = await bcrypt.hash('correct horse', 4);
    const user = userFactory.build({ passwordHash, role: 'ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await authenticate(user.username, 'correct horse');

    expect(result).not.toBeNull();
    expect(result!.user).toEqual({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: 'ADMIN',
      isActive: true,
      onboardingStep: 'DONE',
    });
    expect(result!.token).toHaveLength(64);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // The create call inside the transaction must store the hash, never the raw token.
    const createCall = prismaMock.session.create.mock.calls[0]?.[0];
    expect(createCall?.data.tokenHash).toBe(hashSessionToken(result!.token));
    expect(JSON.stringify(createCall)).not.toContain(result!.token);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct horse', 4);
    prismaMock.user.findUnique.mockResolvedValue(userFactory.build({ passwordHash }));

    expect(await authenticate('someone', 'wrong')).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an unknown user without skipping the password check', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, 'compare');

    expect(await authenticate('ghost', 'anything')).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    compare.mockRestore();
  });

  it('rejects a deactivated user even with the right password', async () => {
    const passwordHash = await bcrypt.hash('correct horse', 4);
    prismaMock.user.findUnique.mockResolvedValue(
      userFactory.build({ passwordHash, isActive: false }),
    );

    expect(await authenticate('someone', 'correct horse')).toBeNull();
  });
});

describe('findUserBySessionToken', () => {
  const rawToken = 'a'.repeat(64);

  it('looks the session up by hash and returns the safe user projection', async () => {
    const user = userFactory.build();
    prismaMock.session.findUnique.mockResolvedValue({
      ...sessionFactory.build({ userId: user.id }),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      },
    } as never);

    const result = await findUserBySessionToken(rawToken);

    expect(prismaMock.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashSessionToken(rawToken) } }),
    );
    expect(result).toEqual(expect.objectContaining({ id: user.id, username: user.username }));
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns null for an expired session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...sessionFactory.build({ expiresAt: new Date(Date.now() - 1000) }),
      user: { id: 'u', username: 'u', fullName: 'U', role: 'USER', isActive: true },
    } as never);

    expect(await findUserBySessionToken(rawToken)).toBeNull();
  });

  it('returns null when the user has been deactivated', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...sessionFactory.build(),
      user: { id: 'u', username: 'u', fullName: 'U', role: 'USER', isActive: false },
    } as never);

    expect(await findUserBySessionToken(rawToken)).toBeNull();
  });

  it('returns null when no session matches', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    expect(await findUserBySessionToken(rawToken)).toBeNull();
  });
});

describe('revoke', () => {
  it('revokeSession deletes by token hash', async () => {
    prismaMock.session.deleteMany.mockResolvedValue({ count: 1 });
    await revokeSession('raw');
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken('raw') },
    });
  });

  it('revokeAllSessions deletes by user', async () => {
    prismaMock.session.deleteMany.mockResolvedValue({ count: 3 });
    await revokeAllSessions('user-1');
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
