import type { ReflectionFact } from '@/lib/rubric/facts';
import type { ReflectionOutput } from '@/services/ai/schemas';
import type { AiResult, GenerateReflectionInput } from '@/services/ai/types';

/** STUB — replaced by the AI agent (task 5.2). */
export async function generateReflection(
  _input: GenerateReflectionInput,
): Promise<AiResult<ReflectionOutput>> {
  return {
    ok: false,
    reason: 'UNAVAILABLE',
    attempts: [],
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
  };
}

/**
 * Output checks beyond the schema (product spec § 11, § 13): every used fact
 * id exists, 40–110 words, every number appears in a used fact, none of the
 * banned words. Returns the reason the paragraph is rejected, or null.
 */
export function checkReflection(
  _output: ReflectionOutput,
  _facts: ReflectionFact[],
): string | null {
  return 'NOT_IMPLEMENTED';
}
