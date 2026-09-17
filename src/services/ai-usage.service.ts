import type { AiKind, AiResult } from '@/services/ai/types';

/**
 * STUB — replaced by the AI agent (task 5.1 "record.ts", placed here because
 * services/ai/** may not import Prisma). Per-user daily caps counted as user
 * operations, admission inserts a PENDING AiCall row under a user-row lock,
 * global token budget soft cap (tech spec § 10.4).
 */
export type Admission =
  { ok: true; callId: string } | { ok: false; code: 'DAILY_AI_CAP' | 'AI_UNAVAILABLE' };

export async function admitOperation(
  _ownerId: string,
  _kind: AiKind,
  _localDate: string,
): Promise<Admission> {
  return { ok: false, code: 'AI_UNAVAILABLE' };
}

export async function finishOperation(
  _callId: string,
  _result: AiResult<unknown>,
  _inputRevision?: number,
): Promise<void> {}
