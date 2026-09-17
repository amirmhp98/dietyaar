import { z } from 'zod';
import { t } from '@/lib/t';

/**
 * Sign-up and account rules (product spec § 5, tech spec § 8). The common-
 * password check is server-only (`lib/common-passwords`) and applied in the
 * service, so this schema is safe for `zodResolver` in the browser.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
/** bcrypt's input limit; longer input is rejected, never truncated. */
export const PASSWORD_MAX_BYTES = 72;

export const signUpUsername = z
  .string()
  .trim()
  .min(USERNAME_MIN, t('validation.usernameMin', { min: USERNAME_MIN }))
  .max(USERNAME_MAX, t('validation.usernameMax', { max: USERNAME_MAX }))
  .regex(/^[A-Za-z0-9_]+$/, t('validation.signupUsernameChars'));

export const newPassword = z
  .string()
  .min(PASSWORD_MIN, t('validation.passwordMin', { min: PASSWORD_MIN }))
  .max(PASSWORD_MAX, t('validation.passwordMax', { max: PASSWORD_MAX }))
  .refine(
    (value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
    t('validation.passwordTooLong'),
  );

export const signUpSchema = z.object({ username: signUpUsername, password: newPassword });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, t('validation.passwordRequired')),
  newPassword,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  username: z.string().trim().min(1, t('validation.usernameRequired')),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
