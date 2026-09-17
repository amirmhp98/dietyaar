import { describe, expect, it } from 'vitest';
import { t } from '@/lib/t';
import { loginSchema } from '@/lib/validations/auth';
import { createUserSchema, resetPasswordSchema, updateUserSchema } from '@/lib/validations/user';

describe('loginSchema', () => {
  it('trims the username and requires both fields', () => {
    expect(loginSchema.parse({ username: '  admin ', password: 'x' })).toEqual({
      username: 'admin',
      password: 'x',
    });
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'a', password: '' }).success).toBe(false);
  });
});

describe('createUserSchema', () => {
  const valid = {
    username: 'new.user',
    password: 'longenough',
    fullName: 'کاربر',
    role: 'USER',
  };

  it('accepts a valid payload', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty full name (sign-up collects none; decision 008)', () => {
    expect(createUserSchema.safeParse({ ...valid, fullName: ' ' }).success).toBe(true);
  });

  it.each([
    ['short username', { ...valid, username: 'ab' }, t('validation.usernameMin', { min: 3 })],
    ['persian username', { ...valid, username: 'کاربر' }, t('validation.usernameChars')],
    ['short password', { ...valid, password: '1234567' }, t('validation.passwordMin', { min: 8 })],
    ['one-letter name', { ...valid, fullName: 'a' }, t('validation.fullNameMin')],
    ['unknown role', { ...valid, role: 'SUPERUSER' }, t('validation.roleInvalid')],
    ['missing role', { ...valid, role: undefined }, t('validation.roleInvalid')],
  ])('rejects %s', (_label, payload, message) => {
    const result = createUserSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(message);
  });
});

describe('updateUserSchema / resetPasswordSchema', () => {
  it('updateUserSchema requires name and role only', () => {
    expect(updateUserSchema.safeParse({ fullName: 'نام', role: 'ADMIN' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ fullName: 'نام' }).success).toBe(false);
  });

  it('resetPasswordSchema enforces the minimum length', () => {
    expect(resetPasswordSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: 'long enough' }).success).toBe(true);
  });
});
