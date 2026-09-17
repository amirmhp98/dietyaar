import type { ReflectionFact } from '@/lib/rubric/facts';
import { complete } from '@/services/ai/deepseek';
import {
  REFLECTION_MAX_TOKENS,
  REFLECTION_MAX_WORDS,
  REFLECTION_MIN_WORDS,
  reflectionSystemPrompt,
  reflectionUserMessage,
} from '@/services/ai/prompts/reflection';
import { reflectionOutputSchema, wordCount, type ReflectionOutput } from '@/services/ai/schemas';
import type { AiResult, GenerateReflectionInput } from '@/services/ai/types';

/**
 * Morning message generation (product spec § 11, tech spec § 10.2). One
 * REFLECTION call; a paragraph that fails `checkReflection` is reported as
 * SCHEMA_REJECTED so the caller writes the deterministic fallback.
 */
export type ReflectionRejection =
  'UNKNOWN_FACT' | 'WORD_COUNT' | 'UNSUPPORTED_NUMBER' | 'BANNED_WORD';

const BANNED = /\b(?:cheat\w*|exercis\w*|training|workouts?|fasting|good foods?|bad foods?)\b/i;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const NAME_FACT = /^The user's name is (.+)\.$/;

const numbersIn = (text: string): string[] =>
  Array.from(text.matchAll(NUMBER), (m) => m[0].replace(/,/g, ''));

/**
 * Output checks beyond the schema (product spec § 11, § 13): every used fact
 * id exists, 40–110 words, every number appears in a used fact, none of the
 * banned words. Returns the reason the paragraph is rejected, or null.
 */
export function checkReflection(
  output: ReflectionOutput,
  facts: ReflectionFact[],
): ReflectionRejection | null {
  const byId = new Map(facts.map((f) => [f.id, f]));
  if (output.usedFactIds.some((id) => !byId.has(id))) return 'UNKNOWN_FACT';

  const words = wordCount(output.paragraph);
  if (words < REFLECTION_MIN_WORDS || words > REFLECTION_MAX_WORDS) return 'WORD_COUNT';

  // Digits inside the greeting name (e.g. a username like "sara84") are not claims.
  let scanned = output.paragraph;
  for (const fact of facts) {
    const name = NAME_FACT.exec(fact.text)?.[1];
    if (name) scanned = scanned.split(name).join(' ');
  }
  const supported = new Set(
    output.usedFactIds.flatMap((id) => numbersIn(byId.get(id)?.text ?? '')),
  );
  if (numbersIn(scanned).some((n) => !supported.has(n))) return 'UNSUPPORTED_NUMBER';

  // English labels quoted from a fact, e.g. "(pre-workout)", are the plan's own words.
  const factText = facts.map((f) => f.text).join('\n');
  const prose = output.paragraph.replace(/\(([^()]*)\)/g, (whole, inner: string) =>
    factText.includes(`(${inner})`) ? '' : whole,
  );
  if (BANNED.test(prose)) return 'BANNED_WORD';
  return null;
}

export async function generateReflection(
  input: GenerateReflectionInput,
): Promise<AiResult<ReflectionOutput>> {
  const result = await complete({
    kind: 'REFLECTION',
    system: reflectionSystemPrompt(),
    user: reflectionUserMessage(input),
    schema: reflectionOutputSchema,
    deadlineAt: input.deadlineAt,
    maxTokens: REFLECTION_MAX_TOKENS,
    userTag: input.userTag,
  });
  if (!result.ok) return result;
  const rejection = checkReflection(result.data, input.facts);
  if (rejection === null) return result;
  const attempts = result.attempts.map((attempt, index) =>
    index === result.attempts.length - 1
      ? { ...attempt, outcome: 'SCHEMA_REJECTED' as const }
      : attempt,
  );
  return {
    ok: false,
    reason: 'SCHEMA_REJECTED',
    attempts,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}
