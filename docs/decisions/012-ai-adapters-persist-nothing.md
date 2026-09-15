# 012 — AI adapters return validated data and persist nothing; prompts are versioned constants

**Decision.** `services/ai/deepseek.ts` exposes one `complete()` that builds the request, sends it
with an `AbortSignal` derived from a deadline, retries once on network error or 5xx only if at
least 40 percent of the deadline remains, parses JSON, validates with a zod schema and returns
`{ ok, data, usage, model, durationMs }` or `{ ok: false, reason }`. It may not import
`@/lib/prisma` (lint rule). The calling service persists the result and one `AiCall` row per
attempt. Prompts and their versions are constants next to their schemas. No AI SDK; plain `fetch`.

**Why.** Keeping the adapter pure makes every product rule that depends on AI output testable with
a mocked `fetch`, keeps provider concerns (JSON mode quirks, empty content, rate limits) in one
file, and lets the service decide what to do with a failure under its own deadline. A raw client
gives exact control over timeouts, which an SDK's retry policy would blur.

**Consequences.** User text is only ever data in the `user` message under a fixed system prompt;
tool calling is never enabled; every `sourceExcerpt` is checked to be a substring of the input.
Swapping providers means one new adapter behind the same signature. See `tech-spec.md` § 10.
