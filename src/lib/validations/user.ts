import { z } from 'zod';
import { t } from '@/lib/t';

/**
 * Shared by server actions (runtime validation) and client forms (zodResolver).
 * Free of Prisma imports so it can ship to the browser; messages come from the
 * active locale's dictionary.
 */

export const USER_ROLES = ['ADMIN', 'USER'] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export function userRoleLabel(role: UserRoleValue): string {
  return t(`users.role.${role}`);
}

const username = z
  .string()
  .trim()
  .min(3, t('validation.usernameMin', { min: 3 }))
  .max(32, t('validation.usernameMax', { max: 32 }))
  .regex(/^[a-z0-9._-]+$/i, t('validation.usernameChars'));

const password = z
  .string()
  .min(8, t('validation.passwordMin', { min: 8 }))
  .max(128, t('validation.passwordMax', { max: 128 }));

const fullName = z
  .string()
  .trim()
  .min(2, t('validation.fullNameMin'))
  .max(80, t('validation.fullNameMax', { max: 80 }));

const role = z.enum(USER_ROLES, { message: t('validation.roleInvalid') });

export const userIdSchema = z.string().min(1, t('validation.userIdInvalid'));

export const createUserSchema = z.object({ username, password, fullName, role });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({ fullName, role });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
