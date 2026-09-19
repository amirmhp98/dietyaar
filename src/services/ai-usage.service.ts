import type { AiOutcome, Prisma } from '@prisma/client';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { aiAvailable } from '@/services/ai/deepseek';
import type { AiFailureReason, AiKind, AiResult } from '@/services/ai/types';

/**
 * AI admission and accounting (tech spec § 10.4). Caps count user operations
 * (one meal analysis, one plan import, one reflection update), not provider
 * attempts. `admitOperation` inserts the PENDING AiCall row under a lock on
 * the user row so concurrent requests cannot both pass the cap;
 * `finishOperation` records the outcome the adapter returned. Lives outside
 * `services/ai/` because that layer may not import Prisma (decision 012).
 */
export type Admission =
  { ok: true; callId: string } | { ok: false; code: 'DAILY_AI_CAP' | 'AI_UNAVAILABLE' };

export interface AdmissionOptions {
  /**
   * A retry of an operation admitted earlier (an import job's second or third
   * attempt): the row is still recorded for the global budget and the ops
   * table, but it carries no `localDate`, so the per-day cap counts the
   * operation once and the cap check is skipped.
   */
  retryOfAdmitted?: boolean;
}

/** Per user per local day. MEAL_TEXT and MEAL_PHOTO share one cap; PLAN_BASELINE is free. */
export const DAILY_MEAL_ANALYSES = 30;
export const DAILY_PLAN_IMPORTS = 6;
export const DAILY_REFLECTION_UPDATES = 3;
/** Tokens reserved per PENDING row when checking the global budget. */
export const PENDING_TOKEN_RESERVE = 8_000;
/** Share of `AI_DAILY_TOKEN_BUDGET` at which new operations are refused. */
export const BUDGET_SOFT_CAP = 0.9;

const CAPS: Partial<Record<AiKind, { kinds: AiKind[]; limit: number }>> = {
  MEAL_TEXT: { kinds: ['MEAL_TEXT', 'MEAL_PHOTO'], limit: DAILY_MEAL_ANALYSES },
  MEAL_PHOTO: { kinds: ['MEAL_TEXT', 'MEAL_PHOTO'], limit: DAILY_MEAL_ANALYSES },
  PLAN_IMPORT: { kinds: ['PLAN_IMPORT'], limit: DAILY_PLAN_IMPORTS },
  REFLECTION: { kinds: ['REFLECTION'], limit: DAILY_REFLECTION_UPDATES },
};

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function admitOperation(
  ownerId: string,
  kind: AiKind,
  localDate: string,
  now: Date = new Date(),
  options: AdmissionOptions = {},
): Promise<Admission> {
  if (!aiAvailable()) return { ok: false, code: 'AI_UNAVAILABLE' };
  return prisma.$transaction(async (tx) => {
    // Serialises concurrent admissions for one user for the rest of the transaction.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${ownerId} FOR UPDATE`;

    const cap = options.retryOfAdmitted ? undefined : CAPS[kind];
    if (cap) {
      const used = await tx.aiCall.count({
        where: { userId: ownerId, localDate, kind: { in: cap.kinds } },
      });
      if (used >= cap.limit) return { ok: false, code: 'DAILY_AI_CAP' } as const;
    }

    const since = utcDayStart(now);
    const completed = await tx.aiCall.aggregate({
      where: { createdAt: { gte: since }, outcome: { not: 'PENDING' } },
      _sum: { promptTokens: true, completionTokens: true },
    });
    const pending = await tx.aiCall.count({
      where: { createdAt: { gte: since }, outcome: 'PENDING' },
    });
    const committed =
      (completed._sum.promptTokens ?? 0) +
      (completed._sum.completionTokens ?? 0) +
      pending * PENDING_TOKEN_RESERVE;
    if (committed >= BUDGET_SOFT_CAP * env.AI_DAILY_TOKEN_BUDGET)
      return { ok: false, code: 'AI_UNAVAILABLE' } as const;

    const row = await tx.aiCall.create({
      data: {
        userId: ownerId,
        kind,
        localDate: options.retryOfAdmitted ? null : localDate,
        outcome: 'PENDING',
      },
      select: { id: true },
    });
    return { ok: true, callId: row.id } as const;
  });
}

const OUTCOME_BY_REASON: Record<AiFailureReason, AiOutcome> = {
  TIMEOUT: 'TIMEOUT',
  INVALID_JSON: 'INVALID_JSON',
  SCHEMA_REJECTED: 'SCHEMA_REJECTED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'PROVIDER_ERROR',
};

export function outcomeOf(result: AiResult<unknown>): AiOutcome {
  return result.ok ? 'OK' : OUTCOME_BY_REASON[result.reason];
}

export async function finishOperation(
  callId: string,
  result: AiResult<unknown>,
  inputRevision?: number,
): Promise<void> {
  const lastAttempt = result.attempts[result.attempts.length - 1];
  await prisma.aiCall.update({
    where: { id: callId },
    data: {
      outcome: outcomeOf(result),
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Math.round(result.durationMs),
      providerModel: result.ok ? result.model : (lastAttempt?.model ?? null),
      attemptsJson: result.attempts as unknown as Prisma.InputJsonValue,
      ...(inputRevision !== undefined ? { inputRevision } : {}),
    },
  });
}
