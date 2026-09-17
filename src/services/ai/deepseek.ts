import type { z } from 'zod';
import type { AiKind, AiResult, DeadlineAt } from '@/services/ai/types';

/** STUB — replaced by the AI agent (task 5.1). */
export interface CompleteInput<T> {
  kind: AiKind;
  system: string;
  user: string;
  images?: Buffer[];
  schema: z.ZodType<T>;
  deadlineAt: DeadlineAt;
  maxTokens: number;
  userTag: string;
}

export function aiAvailable(): boolean {
  return false;
}

export async function complete<T>(_input: CompleteInput<T>): Promise<AiResult<T>> {
  return {
    ok: false,
    reason: 'UNAVAILABLE',
    attempts: [],
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
  };
}
