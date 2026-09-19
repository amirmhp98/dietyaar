import { beforeEach, describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { aiCallFactory } from '@/__tests__/factories';
import { env } from '@/lib/env';
import {
  BUDGET_SOFT_CAP,
  DAILY_MEAL_ANALYSES,
  DAILY_PLAN_IMPORTS,
  DAILY_REFLECTION_UPDATES,
  PENDING_TOKEN_RESERVE,
  admitOperation,
  finishOperation,
  outcomeOf,
} from '@/services/ai-usage.service';

resetPrismaMock();

const NOW = new Date('2026-09-17T10:00:00Z');

function budgetState(tokens: number, pending: number) {
  prismaMock.aiCall.aggregate.mockResolvedValue({
    _sum: { promptTokens: tokens, completionTokens: 0 },
  } as never);
  // First count = per-user cap, second = PENDING rows; tests override the first where needed.
  prismaMock.aiCall.count.mockResolvedValueOnce(0).mockResolvedValueOnce(pending);
}

beforeEach(() => {
  prismaMock.$transaction.mockImplementation(((fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock)) as never);
  prismaMock.$queryRaw.mockResolvedValue([{ id: 'u1' }]);
  prismaMock.aiCall.create.mockResolvedValue(aiCallFactory.build({ id: 'call-1' }));
});

describe('admitOperation', () => {
  it('locks the user row, counts the day, inserts a PENDING row', async () => {
    budgetState(0, 0);
    const admission = await admitOperation('u1', 'MEAL_TEXT', '2026-09-17', NOW);
    expect(admission).toEqual({ ok: true, callId: 'call-1' });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = prismaMock.$queryRaw.mock.calls[0]![0] as unknown as TemplateStringsArray;
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.aiCall.count.mock.calls[0]![0]).toEqual({
      where: { userId: 'u1', localDate: '2026-09-17', kind: { in: ['MEAL_TEXT', 'MEAL_PHOTO'] } },
    });
    expect(prismaMock.aiCall.create).toHaveBeenCalledWith({
      data: { userId: 'u1', kind: 'MEAL_TEXT', localDate: '2026-09-17', outcome: 'PENDING' },
      select: { id: true },
    });
  });

  it('refuses at the per-kind daily caps', async () => {
    prismaMock.aiCall.count.mockResolvedValueOnce(DAILY_MEAL_ANALYSES);
    expect(await admitOperation('u1', 'MEAL_PHOTO', '2026-09-17', NOW)).toEqual({
      ok: false,
      code: 'DAILY_AI_CAP',
    });
    prismaMock.aiCall.count.mockResolvedValueOnce(DAILY_PLAN_IMPORTS);
    expect(await admitOperation('u1', 'PLAN_IMPORT', '2026-09-17', NOW)).toEqual({
      ok: false,
      code: 'DAILY_AI_CAP',
    });
    prismaMock.aiCall.count.mockResolvedValueOnce(DAILY_REFLECTION_UPDATES);
    expect(await admitOperation('u1', 'REFLECTION', '2026-09-17', NOW)).toEqual({
      ok: false,
      code: 'DAILY_AI_CAP',
    });
    expect(prismaMock.aiCall.create).not.toHaveBeenCalled();
  });

  it('records a retry of an admitted operation without counting it toward the cap', async () => {
    prismaMock.aiCall.aggregate.mockResolvedValue({
      _sum: { promptTokens: 0, completionTokens: 0 },
    } as never);
    prismaMock.aiCall.count.mockResolvedValue(0);
    const admission = await admitOperation('u1', 'PLAN_IMPORT', '2026-09-17', NOW, {
      retryOfAdmitted: true,
    });
    expect(admission).toEqual({ ok: true, callId: 'call-1' });
    // No per-user cap query, and no localDate on the row so later cap counts skip it.
    expect(prismaMock.aiCall.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.aiCall.count.mock.calls[0]![0]).toMatchObject({
      where: { outcome: 'PENDING' },
    });
    expect(prismaMock.aiCall.create).toHaveBeenCalledWith({
      data: { userId: 'u1', kind: 'PLAN_IMPORT', localDate: null, outcome: 'PENDING' },
      select: { id: true },
    });
  });

  it('never caps PLAN_BASELINE but still records it', async () => {
    prismaMock.aiCall.aggregate.mockResolvedValue({
      _sum: { promptTokens: 0, completionTokens: 0 },
    } as never);
    prismaMock.aiCall.count.mockResolvedValue(0);
    const admission = await admitOperation('u1', 'PLAN_BASELINE', '2026-09-17', NOW);
    expect(admission).toEqual({ ok: true, callId: 'call-1' });
    // Only the PENDING count ran; no per-user cap query.
    expect(prismaMock.aiCall.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.aiCall.count.mock.calls[0]![0]).toMatchObject({
      where: { outcome: 'PENDING' },
    });
  });

  it('applies the global soft cap on completed tokens plus pending reserves', async () => {
    const limit = BUDGET_SOFT_CAP * env.AI_DAILY_TOKEN_BUDGET;
    budgetState(limit - 2 * PENDING_TOKEN_RESERVE, 2);
    expect(await admitOperation('u1', 'MEAL_TEXT', '2026-09-17', NOW)).toEqual({
      ok: false,
      code: 'AI_UNAVAILABLE',
    });
    budgetState(limit - 2 * PENDING_TOKEN_RESERVE - 1, 2);
    expect(await admitOperation('u1', 'MEAL_TEXT', '2026-09-17', NOW)).toEqual({
      ok: true,
      callId: 'call-1',
    });
    const since = prismaMock.aiCall.aggregate.mock.calls[0]![0]!.where!.createdAt as {
      gte: Date;
    };
    expect(since.gte.toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });

  it('returns AI_UNAVAILABLE without touching the database when no key is set', async () => {
    const key = env.DEEPSEEK_API_KEY;
    (env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY = undefined;
    try {
      expect(await admitOperation('u1', 'MEAL_TEXT', '2026-09-17', NOW)).toEqual({
        ok: false,
        code: 'AI_UNAVAILABLE',
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    } finally {
      (env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY = key;
    }
  });
});

describe('finishOperation', () => {
  it('writes outcome, tokens, duration, model and attempts', async () => {
    prismaMock.aiCall.update.mockResolvedValue(aiCallFactory.build());
    await finishOperation(
      'call-1',
      {
        ok: true,
        data: {},
        attempts: [{ model: 'deepseek-flash', durationMs: 900, outcome: 'OK' }],
        usage: { promptTokens: 700, completionTokens: 200 },
        model: 'deepseek-flash',
        durationMs: 900.4,
      },
      3,
    );
    expect(prismaMock.aiCall.update).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      data: {
        outcome: 'OK',
        promptTokens: 700,
        completionTokens: 200,
        durationMs: 900,
        providerModel: 'deepseek-flash',
        attemptsJson: [{ model: 'deepseek-flash', durationMs: 900, outcome: 'OK' }],
        inputRevision: 3,
      },
    });
  });

  it('maps failure reasons to AiOutcome (UNAVAILABLE → PROVIDER_ERROR)', async () => {
    const failed = (reason: 'UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMITED') => ({
      ok: false as const,
      reason,
      attempts: [{ model: 'deepseek-flash', durationMs: 1, outcome: reason }],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 1,
    });
    expect(outcomeOf(failed('UNAVAILABLE'))).toBe('PROVIDER_ERROR');
    expect(outcomeOf(failed('TIMEOUT'))).toBe('TIMEOUT');
    expect(outcomeOf(failed('RATE_LIMITED'))).toBe('RATE_LIMITED');
    prismaMock.aiCall.update.mockResolvedValue(aiCallFactory.build());
    await finishOperation('call-1', failed('TIMEOUT'));
    const data = prismaMock.aiCall.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ outcome: 'TIMEOUT', providerModel: 'deepseek-flash' });
    expect(data).not.toHaveProperty('inputRevision');
  });
});
