import { z } from 'zod';
import { t } from '@/lib/t';

export const loginSchema = z.object({
  username: z.string().trim().min(1, t('validation.usernameRequired')),
  password: z.string().min(1, t('validation.passwordRequired')),
});

export type LoginInput = z.infer<typeof loginSchema>;
