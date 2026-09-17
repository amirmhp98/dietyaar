import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';

vi.mock('@/services/auth.service', () => ({
  findUserBySessionToken: vi.fn(),
}));

import { findUserBySessionToken } from '@/services/auth.service';
import { getSession, requireAdmin, requireAuth } from '@/lib/auth';

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
