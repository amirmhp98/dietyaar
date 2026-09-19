import {
  DATA_NOTICE,
  LANGUAGE_RULES,
  NUTRITION_SHAPE,
  assumedDefaultsSection,
  categoriesSection,
  marker,
  unitsSection,
} from '@/services/ai/prompts/common';
import {
  MEAL_COMMON_RULES,
  MEAL_EXAMPLE,
  MEAL_REFINE_RULES,
} from '@/services/ai/prompts/meal-text';

/**
 * Meal analysis from one to three photos, optionally with text (product spec
 * § 7). Same output shape as the text prompt; the photos are attached to the
 * user message as inline images. No profile field is ever sent.
 */
export const MEAL_PHOTO_PROMPT_VERSION = 2;

export function mealPhotoSystemPrompt(): string {
  return [
    marker('MEAL_PHOTO', MEAL_PHOTO_PROMPT_VERSION),
    'You identify the foods shown in photos of one meal and estimate the nutrition of each recorded portion, so the person can review it.',
    DATA_NOTICE,
    LANGUAGE_RULES,
    'Photos: all attached images show the SAME meal from different angles unless the text says otherwise; never count each image as another serving. A photo of a shared dish does not show how much the person ate: set that item `quantityUnknown: true` and ask "How much of this dish did you eat?" with choices. Ingredients you cannot see (oil, sauce, sugar) stay assumptions; ask when they matter.',
    'Any text in the user message adds to or corrects what the photos show (hidden ingredients, quantities). Keep names as the text writes them; name foods only shown in photos in English for both `originalName` and `englishLabel`.',
    MEAL_COMMON_RULES,
    MEAL_REFINE_RULES,
    unitsSection(),
    assumedDefaultsSection(),
    categoriesSection(),
    NUTRITION_SHAPE,
    '',
    'Example of the exact json shape to return (values are illustrative):',
    JSON.stringify(MEAL_EXAMPLE, null, 1),
  ].join('\n');
}
