import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(async () => ({
    id: 'admin-1',
    username: 'admin',
    fullName: 'مدیر',
    role: 'ADMIN',
    isActive: true,
  })),
}));

vi.mock('@/services/user.service', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserActive: vi.fn(),
  resetPassword: vi.fn(),
}));

import * as users from '@/services/user.service';
import { requireAdmin } from '@/lib/auth';
import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from '@/actions/user.actions';

const validCreate = {
  username: 'newbie',
  password: 'longenough',
  fullName: 'تازه',
  role: 'USER',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUserAction', () => {
  it('requires admin, validates, calls the service and revalidates', async () => {
    vi.mocked(users.createUser).mockResolvedValue({} as never);

    const result = await createUserAction(validCreate);

    expect(requireAdmin).toHaveBeenCalled();
    expect(users.createUser).toHaveBeenCalledWith(validCreate);
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('returns field errors for invalid input without calling the service', async () => {
    const result = await createUserAction({ ...validCreate, password: 'short' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.password?.[0]).toBe(t('validation.passwordMin', { min: 8 }));
    }
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it('surfaces ServiceError messages verbatim', async () => {
    vi.mocked(users.createUser).mockRejectedValue(new ServiceError('تکراری', 'USERNAME_TAKEN'));

    const result = await createUserAction(validCreate);

    expect(result).toEqual({ ok: false, error: 'تکراری' });
  });

  it('hides unexpected errors behind a generic message', async () => {
    vi.mocked(users.createUser).mockRejectedValue(new Error('connection refused'));

    const result = await createUserAction(validCreate);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain('connection refused');
  });
});

describe('updateUserAction', () => {
  it('passes the acting admin id to the service', async () => {
    vi.mocked(users.updateUser).mockResolvedValue({} as never);

    await updateUserAction('u-2', { fullName: 'نام', role: 'ADMIN' });

    expect(users.updateUser).toHaveBeenCalledWith(
      'u-2',
      { fullName: 'نام', role: 'ADMIN' },
      'admin-1',
    );
  });

  it('rejects an empty user id', async () => {
    const result = await updateUserAction('', { fullName: 'نام', role: 'ADMIN' });
    expect(result.ok).toBe(false);
    expect(users.updateUser).not.toHaveBeenCalled();
  });
});

describe('setUserActiveAction / resetPasswordAction', () => {
  it('setUserActiveAction coerces the flag and forwards the actor', async () => {
    vi.mocked(users.setUserActive).mockResolvedValue({} as never);

    await setUserActiveAction('u-2', false);

    expect(users.setUserActive).toHaveBeenCalledWith('u-2', false, 'admin-1');
  });

  it('resetPasswordAction validates the password', async () => {
    const bad = await resetPasswordAction('u-2', { password: 'short' });
    expect(bad.ok).toBe(false);
    expect(users.resetPassword).not.toHaveBeenCalled();

    vi.mocked(users.resetPassword).mockResolvedValue();
    const good = await resetPasswordAction('u-2', { password: 'long enough' });
    expect(good.ok).toBe(true);
    expect(users.resetPassword).toHaveBeenCalledWith('u-2', 'long enough');
  });
});
