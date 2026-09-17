import { complete } from '@/services/ai/deepseek';
import { mealPhotoSystemPrompt } from '@/services/ai/prompts/meal-photo';
import {
  MEAL_ANALYSIS_MAX_TOKENS,
  mealTextSystemPrompt,
  mealUserMessage,
} from '@/services/ai/prompts/meal-text';
import { mealAnalysisOutputSchema, type MealAnalysisOutput } from '@/services/ai/schemas';
import type { AiResult, AnalyzeMealInput, MealPlanContext } from '@/services/ai/types';

/**
 * Meal analysis (product spec § 7 "AI review", tech spec § 10.2): one
 * MEAL_TEXT or MEAL_PHOTO call. The input carries no profile fields by
 * construction. Nutrition comes back as labelled AI estimates; the suggested
 * slot and option are checked against the supplied plan context.
 */
const EMPTY: MealAnalysisOutput = {
  items: [],
  suggestedSlot: null,
  suggestedOptionIndex: null,
  questions: [],
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Keeps the suggestion only when it names a supplied slot (and a real option of it). */
export function resolveSuggestion(
  output: MealAnalysisOutput,
  planContext: MealPlanContext | null,
): Pick<MealAnalysisOutput, 'suggestedSlot' | 'suggestedOptionIndex'> {
  if (!output.suggestedSlot || !planContext)
    return { suggestedSlot: null, suggestedOptionIndex: null };
  const wanted = output.suggestedSlot;
  const slot = planContext.slots.find(
    (s) =>
      sameName(s.originalName, wanted.originalName) ||
      sameName(s.englishLabel, wanted.englishLabel) ||
      sameName(s.originalName, wanted.englishLabel),
  );
  if (!slot) return { suggestedSlot: null, suggestedOptionIndex: null };
  const optionIndex =
    output.suggestedOptionIndex !== null && output.suggestedOptionIndex < slot.options.length
      ? output.suggestedOptionIndex
      : null;
  return {
    suggestedSlot: { originalName: slot.originalName, englishLabel: slot.englishLabel },
    suggestedOptionIndex: optionIndex,
  };
}

export async function analyzeMeal(input: AnalyzeMealInput): Promise<AiResult<MealAnalysisOutput>> {
  const hasText = input.text !== null && input.text.trim() !== '';
  const hasImages = input.images.length > 0;
  if (!hasText && !hasImages) {
    return {
      ok: true,
      data: EMPTY,
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      model: '',
      durationMs: 0,
    };
  }
  const result = await complete({
    kind: hasImages ? 'MEAL_PHOTO' : 'MEAL_TEXT',
    system: hasImages ? mealPhotoSystemPrompt() : mealTextSystemPrompt(),
    user: mealUserMessage(input.text, input.planContext),
    images: hasImages ? input.images : undefined,
    schema: mealAnalysisOutputSchema,
    deadlineAt: input.deadlineAt,
    maxTokens: MEAL_ANALYSIS_MAX_TOKENS,
    userTag: input.userTag,
  });
  if (!result.ok) return result;

  const items = result.data.items.map((item) => ({
    ...item,
    quantityUnknown: item.quantityUnknown || item.quantity === null,
    nutrition:
      item.nutrition === null
        ? null
        : { ...item.nutrition, source: 'AI_ESTIMATE' as const, isEstimate: true },
  }));
  const questions = result.data.questions.filter(
    (q) => q.itemIndex === null || q.itemIndex < items.length,
  );
  return {
    ...result,
    data: { items, questions, ...resolveSuggestion(result.data, input.planContext) },
  };
}
