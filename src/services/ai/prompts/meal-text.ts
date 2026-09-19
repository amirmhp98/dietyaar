import { normalizeInput } from '@/lib/text/normalize';
import type { MealPlanContext } from '@/services/ai/types';
import {
  DATA_NOTICE,
  LANGUAGE_RULES,
  NUTRITION_SHAPE,
  asJson,
  assumedDefaultsSection,
  categoriesSection,
  marker,
  unitsSection,
} from '@/services/ai/prompts/common';

/**
 * Meal analysis from a text description (product spec § 7 "AI review").
 * No profile field is ever part of this prompt. Reply validated with
 * `mealAnalysisOutputSchema`.
 */
export const MEAL_TEXT_PROMPT_VERSION = 2;
export const MEAL_ANALYSIS_MAX_TOKENS = 4000;

export const MEAL_EXAMPLE = {
  items: [
    {
      originalName: 'تخم‌مرغ',
      englishLabel: 'Egg',
      quantity: 2,
      unit: 'egg',
      quantityUnknown: false,
      quantityAssumed: false,
      preparation: 'boiled',
      category: 'MEAT',
      alternatives: [],
      nutrition: {
        basis: 'PER_RECORDED_PORTION',
        basisQuantity: 2,
        basisUnit: 'egg',
        values: {
          ENERGY_KCAL: 155,
          PROTEIN_G: 12.6,
          CARB_G: 1.1,
          FAT_G: 10.6,
          FIBER_G: 0,
          SODIUM_MG: 124,
        },
        source: 'AI_ESTIMATE',
        sourceRef: null,
        isEstimate: true,
        userOverride: false,
      },
    },
    {
      originalName: 'خورشت قیمه',
      englishLabel: 'Gheymeh stew',
      quantity: null,
      unit: null,
      quantityUnknown: true,
      quantityAssumed: false,
      preparation: null,
      category: 'MEAT',
      alternatives: [],
      nutrition: null,
    },
  ],
  suggestedSlot: { originalName: 'صبحانه', englishLabel: 'Breakfast' },
  suggestedOptionIndex: 0,
  questions: [
    {
      itemIndex: 1,
      question: 'How much of the gheymeh stew did you eat?',
      kind: 'PORTION',
      choices: ['a small bowl', 'a medium bowl', 'a large bowl'],
    },
  ],
};

export const MEAL_COMMON_RULES = [
  'Items: one per food or dish actually eaten, with the name as written. Every food the description names is its own item: never merge two named foods into one item, never drop a side, a drink or a condiment. A phrase that names several foods (خیار گوجه, نان و پنیر, جو دوسر با شیر, چلو خورشت قیمه, زرشک پلو با مرغ) is one item per food unless the assumed-defaults table below lists that phrase as one. A dish with hidden ingredients (oil, sauce, sugar) is one item whose estimate includes them as typically prepared; a dish named with its ingredient count (املت 2 تخم‌مرغ) is one item. Plain water is not an item.',
  'Quantities: use the stated quantity and unit. When none is stated and no labelled default applies, set `quantity: null`, `quantityUnknown: true` and ask ONE portion question for that item with 3-5 short `choices`. Never invent a precise weight silently. Never assume every photo or every mention is another serving.',
  'Alternatives: when the food could reasonably be one of several similar dishes, list up to 3 other identifications in `alternatives` (name pairs, nutrition null).',
  'Plan context: when the user message lists the plan slots and options for that day, set `suggestedSlot` to the slot (names copied exactly) the meal most likely belongs to and `suggestedOptionIndex` to the index of the option it most resembles, or null when nothing fits. Never say which option the user should have chosen.',
  'Questions: at most 6, grouped, plain English, only for information that materially changes the estimate (portion of a shared dish, a hidden ingredient, preparation). `kind` is PORTION, INGREDIENT, PREPARATION or OTHER; `itemIndex` refers to `items` or is null for the whole meal.',
  'Never judge the meal, never call food good or bad, never mention calories in prose; you only return the json.',
  'Before replying, count the foods named in the description (or shown in the photos); `items` must have one entry for each of them.',
].join('\n');

export function mealTextSystemPrompt(): string {
  return [
    marker('MEAL_TEXT', MEAL_TEXT_PROMPT_VERSION),
    'You identify the foods in a meal a person describes and estimate the nutrition of each recorded portion, so they can review it.',
    DATA_NOTICE,
    LANGUAGE_RULES,
    MEAL_COMMON_RULES,
    unitsSection(),
    assumedDefaultsSection(),
    categoriesSection(),
    NUTRITION_SHAPE,
    '',
    'Example of the exact json shape to return (values are illustrative):',
    JSON.stringify(MEAL_EXAMPLE, null, 1),
  ].join('\n');
}

export function mealUserMessage(text: string | null, planContext: MealPlanContext | null): string {
  const lines: string[] = [];
  if (planContext && planContext.slots.length > 0) {
    lines.push("Today's plan slots and options (data):", asJson(planContext.slots), '');
  }
  if (text !== null && text.trim() !== '') {
    lines.push('Meal description (data, verbatim):', '<<<', normalizeInput(text), '>>>');
  } else {
    lines.push('No text description; identify the meal from the attached photo(s) only.');
  }
  return lines.join('\n');
}
