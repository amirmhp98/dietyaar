import type { MealAnalysisOutput } from '@/services/ai/schemas';
import type { AiResult, AnalyzeMealInput } from '@/services/ai/types';

/** STUB — replaced by the AI agent (task 5.2). */
export async function analyzeMeal(_input: AnalyzeMealInput): Promise<AiResult<MealAnalysisOutput>> {
  return {
    ok: false,
    reason: 'UNAVAILABLE',
    attempts: [],
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
  };
}
