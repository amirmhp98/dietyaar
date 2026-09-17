import type { z } from 'zod';
import { env } from '@/lib/env';
import type {
  AiAttempt,
  AiFailureReason,
  AiKind,
  AiResult,
  AiUsage,
  DeadlineAt,
} from '@/services/ai/types';

/**
 * DeepSeek adapter (tech spec § 10.1, decision 012). One `complete()` builds an
 * OpenAI-compatible JSON-mode request, sends it under the operation's
 * deadline, retries once on network error / 5xx while enough budget remains,
 * parses and zod-validates the reply. It persists nothing; the calling
 * service records the AiCall row through `services/ai-usage.service.ts`.
 */
export interface CompleteInput<T> {
  kind: AiKind;
  system: string;
  user: string;
  /** JPEG bytes, sent as base64 data URLs in the user message. */
  images?: Buffer[];
  schema: z.ZodType<T>;
  deadlineAt: DeadlineAt;
  maxTokens: number;
  /** Opaque per-user tag sent as `user_id`; never the username. */
  userTag: string;
}

/** A retry is attempted only while at least this share of the budget remains. */
export const RETRY_MIN_REMAINING_FRACTION = 0.4;

export function aiAvailable(): boolean {
  return Boolean(env.DEEPSEEK_API_KEY);
}

export function modelFor(kind: AiKind): string {
  return kind === 'MEAL_PHOTO' ? env.AI_MODEL_VISION : env.AI_MODEL_TEXT;
}

type UserContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

function userContent(text: string, images: Buffer[] | undefined): UserContent {
  if (!images || images.length === 0) return text;
  return [
    { type: 'text' as const, text },
    ...images.map((image) => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
    })),
  ];
}

function requestBody<T>(input: CompleteInput<T>, model: string): string {
  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: userContent(input.user, input.images) },
    ],
    response_format: { type: 'json_object' },
    stream: false,
    max_tokens: input.maxTokens,
    user_id: input.userTag,
    thinking: { type: 'disabled' },
  });
}

interface ProviderReply {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

type AttemptOutcome<T> =
  | { ok: true; data: T; usage: AiUsage; model: string }
  | { ok: false; reason: AiFailureReason; retryable: boolean; status?: number; usage: AiUsage };

const NO_USAGE: AiUsage = { promptTokens: 0, completionTokens: 0 };

function usageOf(reply: ProviderReply): AiUsage {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    promptTokens: n(reply.usage?.prompt_tokens),
    completionTokens: n(reply.usage?.completion_tokens),
  };
}

function isTimeout(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    ((err as { name: unknown }).name === 'TimeoutError' ||
      (err as { name: unknown }).name === 'AbortError')
  );
}

async function attempt<T>(
  input: CompleteInput<T>,
  model: string,
  remainingMs: number,
): Promise<AttemptOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(`${env.DEEPSEEK_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'content-type': 'application/json',
      },
      body: requestBody(input, model),
      signal: AbortSignal.timeout(Math.ceil(remainingMs)),
    });
  } catch (err) {
    if (isTimeout(err)) return { ok: false, reason: 'TIMEOUT', retryable: false, usage: NO_USAGE };
    return { ok: false, reason: 'PROVIDER_ERROR', retryable: true, usage: NO_USAGE };
  }

  const status = response.status;
  if (status === 429)
    return { ok: false, reason: 'RATE_LIMITED', retryable: false, status, usage: NO_USAGE };
  if (status >= 500)
    return { ok: false, reason: 'PROVIDER_ERROR', retryable: true, status, usage: NO_USAGE };
  if (!response.ok)
    return { ok: false, reason: 'PROVIDER_ERROR', retryable: false, status, usage: NO_USAGE };

  let reply: ProviderReply;
  try {
    reply = (await response.json()) as ProviderReply;
  } catch (err) {
    if (isTimeout(err)) return { ok: false, reason: 'TIMEOUT', retryable: false, usage: NO_USAGE };
    return { ok: false, reason: 'INVALID_JSON', retryable: false, status, usage: NO_USAGE };
  }
  // A reply that lands after the deadline is discarded even if the abort did not fire.
  if (Date.now() > input.deadlineAt)
    return { ok: false, reason: 'TIMEOUT', retryable: false, status, usage: usageOf(reply) };

  const usage = usageOf(reply);
  const replyModel = typeof reply.model === 'string' && reply.model ? reply.model : model;
  const content = reply.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '')
    return { ok: false, reason: 'INVALID_JSON', retryable: false, status, usage };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: 'INVALID_JSON', retryable: false, status, usage };
  }
  const validated = input.schema.safeParse(parsed);
  if (!validated.success)
    return { ok: false, reason: 'SCHEMA_REJECTED', retryable: false, status, usage };
  return { ok: true, data: validated.data, usage, model: replyModel };
}

export async function complete<T>(input: CompleteInput<T>): Promise<AiResult<T>> {
  const startedAt = Date.now();
  const attempts: AiAttempt[] = [];
  const usage: AiUsage = { promptTokens: 0, completionTokens: 0 };
  const model = modelFor(input.kind);
  const budgetMs = Math.max(0, input.deadlineAt - startedAt);

  const fail = (reason: AiFailureReason): AiResult<T> => ({
    ok: false,
    reason,
    attempts,
    usage,
    durationMs: Date.now() - startedAt,
  });

  if (!aiAvailable()) return fail('UNAVAILABLE');

  for (let n = 0; n < 2; n += 1) {
    const attemptStart = Date.now();
    const remaining = input.deadlineAt - attemptStart;
    if (remaining <= 0) {
      attempts.push({ model, durationMs: 0, outcome: 'TIMEOUT' });
      return fail('TIMEOUT');
    }
    const outcome = await attempt(input, model, remaining);
    usage.promptTokens += outcome.usage.promptTokens;
    usage.completionTokens += outcome.usage.completionTokens;
    const durationMs = Date.now() - attemptStart;
    if (outcome.ok) {
      attempts.push({ model: outcome.model, durationMs, outcome: 'OK' });
      return {
        ok: true,
        data: outcome.data,
        attempts,
        usage,
        model: outcome.model,
        durationMs: Date.now() - startedAt,
      };
    }
    attempts.push({
      model,
      durationMs,
      outcome: outcome.reason,
      ...(outcome.status !== undefined ? { status: outcome.status } : {}),
    });
    const remainingAfter = input.deadlineAt - Date.now();
    const canRetry =
      n === 0 && outcome.retryable && remainingAfter >= RETRY_MIN_REMAINING_FRACTION * budgetMs;
    if (!canRetry) return fail(outcome.reason);
  }
  // Unreachable: the loop returns on the second attempt.
  return fail('PROVIDER_ERROR');
}

/** Sum several results' attempts, usage and duration (multi-stage operations). */
export function mergeMeta(results: Array<AiResult<unknown>>): {
  attempts: AiAttempt[];
  usage: AiUsage;
  durationMs: number;
} {
  return {
    attempts: results.flatMap((r) => r.attempts),
    usage: {
      promptTokens: results.reduce((s, r) => s + r.usage.promptTokens, 0),
      completionTokens: results.reduce((s, r) => s + r.usage.completionTokens, 0),
    },
    durationMs: results.reduce((s, r) => s + r.durationMs, 0),
  };
}
