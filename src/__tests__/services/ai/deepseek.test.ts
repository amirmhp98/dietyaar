import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { env } from '@/lib/env';
import { complete, mergeMeta, type CompleteInput } from '@/services/ai/deepseek';

const schema = z.object({ answer: z.number() });

function reply(content: unknown, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      model: 'deepseek-flash',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      ...extra,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function input(overrides: Partial<CompleteInput<{ answer: number }>> = {}) {
  return {
    kind: 'MEAL_TEXT' as const,
    system: '# dietyaar:MEAL_TEXT v1\njson',
    user: 'two eggs',
    schema,
    deadlineAt: Date.now() + 2_000,
    maxTokens: 100,
    userTag: 'u-tag',
    ...overrides,
  };
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('complete', () => {
  it('sends a JSON-mode request and returns validated data with usage', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"answer": 42, "extra": 1}'));
    const result = await complete(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ answer: 42 });
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
    expect(result.model).toBe('deepseek-flash');
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.outcome).toBe('OK');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ai.test/chat/completions');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'deepseek-flash',
      response_format: { type: 'json_object' },
      stream: false,
      max_tokens: 100,
      user_id: 'u-tag',
      thinking: { type: 'disabled' },
    });
    expect(body.messages[0]).toEqual({ role: 'system', content: '# dietyaar:MEAL_TEXT v1\njson' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'two eggs' });
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses the vision model and inlines images for MEAL_PHOTO', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"answer": 1}'));
    await complete(input({ kind: 'MEAL_PHOTO', images: [Buffer.from('abc')] }));
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.model).toBe(env.AI_MODEL_VISION);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'two eggs' },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${Buffer.from('abc').toString('base64')}` },
      },
    ]);
  });

  it('reports INVALID_JSON for non-JSON content', async () => {
    fetchMock.mockResolvedValueOnce(reply('not json at all'));
    const result = await complete(input());
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_JSON' });
    expect(result.attempts[0]?.outcome).toBe('INVALID_JSON');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports INVALID_JSON for empty content', async () => {
    fetchMock.mockResolvedValueOnce(reply(''));
    const result = await complete(input());
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_JSON' });
  });

  it('reports SCHEMA_REJECTED when the JSON does not match the schema', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"answer": "forty-two"}'));
    const result = await complete(input());
    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_REJECTED' });
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it('reports RATE_LIMITED on 429 without retrying', async () => {
    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    const result = await complete(input());
    expect(result).toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
    expect(result.attempts).toEqual([
      expect.objectContaining({ outcome: 'RATE_LIMITED', status: 429 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 5xx when enough budget remains', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(reply('{"answer": 7}'));
    const result = await complete(input());
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempts.map((a) => a.outcome)).toEqual(['PROVIDER_ERROR', 'OK']);
  });

  it('retries once on a network error and then gives up', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = await complete(input());
    expect(result).toMatchObject({ ok: false, reason: 'PROVIDER_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempts).toHaveLength(2);
  });

  it('does not retry when less than 40 % of the deadline remains', async () => {
    const start = Date.now();
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response('boom', { status: 500 })), 150),
        ),
    );
    const result = await complete(input({ deadlineAt: start + 200 }));
    expect(result).toMatchObject({ ok: false, reason: 'PROVIDER_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports TIMEOUT when the abort signal fires', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const result = await complete(input({ deadlineAt: Date.now() + 30 }));
    expect(result).toMatchObject({ ok: false, reason: 'TIMEOUT' });
    expect(result.attempts[0]?.outcome).toBe('TIMEOUT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discards a response that lands after the deadline', async () => {
    fetchMock.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(reply('{"answer": 1}')), 80)),
    );
    const result = await complete(input({ deadlineAt: Date.now() + 30 }));
    expect(result).toMatchObject({ ok: false, reason: 'TIMEOUT' });
  });

  it('returns TIMEOUT without a request when the deadline has already passed', async () => {
    const result = await complete(input({ deadlineAt: Date.now() - 1 }));
    expect(result).toMatchObject({ ok: false, reason: 'TIMEOUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns UNAVAILABLE without a request when no key is configured', async () => {
    const key = env.DEEPSEEK_API_KEY;
    (env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY = undefined;
    try {
      const result = await complete(input());
      expect(result).toMatchObject({ ok: false, reason: 'UNAVAILABLE' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      (env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY = key;
    }
  });
});

describe('mergeMeta', () => {
  it('sums attempts, usage and duration', () => {
    const merged = mergeMeta([
      {
        ok: false,
        reason: 'PROVIDER_ERROR',
        attempts: [{ model: 'm', durationMs: 5, outcome: 'PROVIDER_ERROR' }],
        usage: { promptTokens: 1, completionTokens: 2 },
        durationMs: 5,
      },
      {
        ok: true,
        data: {},
        attempts: [{ model: 'm', durationMs: 7, outcome: 'OK' }],
        usage: { promptTokens: 3, completionTokens: 4 },
        model: 'm',
        durationMs: 7,
      },
    ]);
    expect(merged).toEqual({
      attempts: [
        { model: 'm', durationMs: 5, outcome: 'PROVIDER_ERROR' },
        { model: 'm', durationMs: 7, outcome: 'OK' },
      ],
      usage: { promptTokens: 4, completionTokens: 6 },
      durationMs: 12,
    });
  });
});
