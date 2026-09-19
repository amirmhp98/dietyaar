import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';

vi.mock('@/services/auth.service', () => ({
  findUserBySessionToken: vi.fn(),
}));

import { findUserBySessionToken } from '@/services/auth.service';
import { getSession, requireAdmin, requireApiAuth, requireAuth } from '@/lib/auth';

const admin = {
  id: 'a',
  username: 'admin',
  fullName: 'Administrator',
  role: 'ADMIN' as const,
  isActive: true,
  onboardingStep: 'DONE' as const,
};
const plainUser = { ...admin, id: 'b', username: 'ana', role: 'USER' as const };
const cookieStore = { get: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue(cookieStore as never);
});

describe('getSession', () => {
  it('returns null without a cookie and never hits the service', async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
    expect(findUserBySessionToken).not.toHaveBeenCalled();
  });

  it('resolves the cookie token through the service', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' });
    vi.mocked(findUserBySessionToken).mockResolvedValue(admin);
    expect(await getSession()).toEqual(admin);
    expect(findUserBySessionToken).toHaveBeenCalledWith('tok');
  });
});

describe('requireAuth / requireAdmin', () => {
  it('requireAuth redirects anonymous requests to /login', async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('requireAdmin sends non-admins home', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' });
    vi.mocked(findUserBySessionToken).mockResolvedValue(plainUser);
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('requireAdmin returns the admin user', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' });
    vi.mocked(findUserBySessionToken).mockResolvedValue(admin);
    expect(await requireAdmin()).toEqual(admin);
  });
});

describe('requireApiAuth', () => {
  it('answers 401 JSON for a missing or expired session instead of redirecting', async () => {
    cookieStore.get.mockReturnValue({ value: 'stale' });
    vi.mocked(findUserBySessionToken).mockResolvedValue(null);
    const auth = await requireApiAuth();
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.response.status).toBe(401);
    expect(auth.response.headers.get('cache-control')).toBe('no-store');
    expect(await auth.response.json()).toEqual({ error: 'UNAUTHENTICATED' });
  });

  it('returns the user when the session is valid', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' });
    vi.mocked(findUserBySessionToken).mockResolvedValue(plainUser);
    expect(await requireApiAuth()).toEqual({ ok: true, user: plainUser });
  });
});
