import { beforeEach, describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  assertLoginAllowed,
  authenticate,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginThrottle,
} from '@/services/auth.service';

resetPrismaMock();
beforeEach(() => resetLoginThrottle());

describe('login throttle', () => {
  it('allows up to the limit, then locks the username out', () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) recordLoginFailure('alice');
    expect(() => assertLoginAllowed('alice')).toThrowError(
      expect.objectContaining({ code: 'TOO_MANY_ATTEMPTS' }),
    );
    // Other usernames are unaffected.
    expect(() => assertLoginAllowed('bob')).not.toThrow();
  });

  it('releases the lock after the window passes', () => {
    const start = 1_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) recordLoginFailure('alice', start);
    expect(() => assertLoginAllowed('alice', start + 1000)).toThrow();
    expect(() => assertLoginAllowed('alice', start + LOGIN_WINDOW_MS + 1)).not.toThrow();
  });

  it('a successful login clears the counter', () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i++) recordLoginFailure('alice');
    clearLoginFailures('alice');
    recordLoginFailure('alice');
    expect(() => assertLoginAllowed('alice')).not.toThrow();
  });

  it('authenticate refuses a locked-out username before touching the database', async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) recordLoginFailure('alice');
    await expect(authenticate('alice', 'whatever')).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
