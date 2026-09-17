import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies, headers } from 'next/headers';
import { t } from '@/lib/t';
import { ServiceError } from '@/lib/errors';

vi.mock('@/services/account.service', () => ({
  signUp: vi.fn(),
  changePassword: vi.fn(),
  requestDeletion: vi.fn(),
  deleteUnderageAccount: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(async () => ({
    id: 'u1',
    username: 'sara',
    onboardingStep: 'AGE',
    role: 'USER',
    isActive: true,
    fullName: null,
  })),
}));
vi.mock('next/headers', async () => ({
  cookies: vi.fn(),
  headers: vi.fn(async () => new Headers({ 'x-real-ip': '10.0.0.1' })),
}));

import * as account from '@/services/account.service';
import { resetRateLimits } from '@/services/rate-limit.service';
import {
  changePasswordAction,
  requestAccountDeletionAction,
  signUpAction,
} from '@/actions/account.actions';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const cookieStore = { get: vi.fn(), has: vi.fn(), set: vi.fn(), delete: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  vi.mocked(cookies).mockResolvedValue(cookieStore as never);
});

describe('signUpAction', () => {
  it('validates before calling the service', async () => {
    const result = await signUpAction(null, formData({ username: 'ab', password: 'x' }));
    expect(result?.error).toBe(t('validation.usernameMin', { min: 3 }));
    expect(account.signUp).not.toHaveBeenCalled();
  });

  it('sets the session cookie and redirects to onboarding', async () => {
    vi.mocked(account.signUp).mockResolvedValue({
      user: {
        id: 'u',
        username: 'sara',
        fullName: null,
        role: 'USER',
        isActive: true,
        onboardingStep: 'AGE',
      },
      token: 'raw',
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(
      signUpAction(null, formData({ username: 'sara', password: 'correct-horse-9' })),
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding');
    expect(cookieStore.set).toHaveBeenCalledWith(
      'session',
      'raw',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('surfaces service errors and rate-limits the eleventh attempt per IP', async () => {
    vi.mocked(account.signUp).mockRejectedValue(new ServiceError('taken', 'USERNAME_TAKEN'));
    for (let i = 0; i < 10; i += 1) {
      expect(
        await signUpAction(null, formData({ username: 'sara', password: 'correct-horse-9' })),
      ).toEqual({ error: 'taken' });
    }
    expect(
      await signUpAction(null, formData({ username: 'sara', password: 'correct-horse-9' })),
    ).toEqual({ error: t('signup.errors.rateLimited') });
    expect(headers).toHaveBeenCalled();
  });
});

describe('changePasswordAction / requestAccountDeletionAction', () => {
  it('passes the current cookie token so the current device stays signed in', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' });
    const result = await changePasswordAction({
      currentPassword: 'old-pass-123',
      newPassword: 'new-pass-456',
    });
    expect(result.ok).toBe(true);
    expect(account.changePassword).toHaveBeenCalledWith(
      'u1',
      'old-pass-123',
      'new-pass-456',
      'tok',
    );
  });

  it('deletes the session cookie after a deletion request', async () => {
    const result = await requestAccountDeletionAction({ username: 'sara' });
    expect(result.ok).toBe(true);
    expect(cookieStore.delete).toHaveBeenCalledWith('session');
  });
});
