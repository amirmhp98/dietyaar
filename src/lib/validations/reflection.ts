import { z } from 'zod';
import { localDateSchema } from '@/lib/validations/meal';

/** "Got it" on the reflection card: the local date whose message is acknowledged. */
export const acknowledgeReflectionSchema = z.object({
  localDate: localDateSchema,
});

export type AcknowledgeReflectionInput = z.infer<typeof acknowledgeReflectionSchema>;
