import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { t } from '@/lib/t';

vi.mock('@/services/auth.service', () => ({
  authenticate: vi.fn(),
  revokeSession: vi.fn(),
}));

import { authenticate, revokeSession } from '@/services/auth.service';
import { loginAction, logoutAction } from '@/actions/auth.actions';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const cookieStore = { get: vi.fn(), has: vi.fn(), set: vi.fn(), delete: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue(cookieStore as never);
});

describe('loginAction', () => {
  it('returns a validation message when fields are missing', async () => {
    const result = await loginAction(null, formData({ username: ' ', password: '' }));
    expect(result?.error).toBe(t('validation.usernameRequired'));
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('returns the generic error when credentials are rejected', async () => {
    vi.mocked(authenticate).mockResolvedValue(null);

    const result = await loginAction(null, formData({ username: 'admin', password: 'nope' }));

    expect(result).toEqual({ error: t('auth.errors.invalidCredentials') });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('sets an http-only session cookie and redirects home on success', async () => {
    const expiresAt = new Date(Date.now() + 1000);
    vi.mocked(authenticate).mockResolvedValue({
      user: {
        id: 'u',
        username: 'admin',
        fullName: 'A',
        role: 'ADMIN',
        isActive: true,
        onboardingStep: 'DONE',
      },
      token: 'raw-token',
      expiresAt,
    });

    await expect(
      loginAction(null, formData({ username: ' admin ', password: 'pw' })),
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(authenticate).toHaveBeenCalledWith('admin', 'pw');
    expect(cookieStore.set).toHaveBeenCalledWith(
      'session',
      'raw-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', expires: expiresAt }),
    );
  });
});

describe('logoutAction', () => {
  it('revokes the session, clears the cookie and redirects to /login', async () => {
    cookieStore.get.mockReturnValue({ value: 'raw-token' });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(revokeSession).toHaveBeenCalledWith('raw-token');
    expect(cookieStore.delete).toHaveBeenCalledWith('session');
  });

  it('still clears the cookie when there is no token', async () => {
    cookieStore.get.mockReturnValue(undefined);

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(revokeSession).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith('session');
  });
});
