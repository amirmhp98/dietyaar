import type { BaselineItemInput } from '@/services/ai/types';
import {
  DATA_NOTICE,
  LANGUAGE_RULES,
  NUTRITION_SHAPE,
  asJson,
  marker,
  unitsSection,
} from '@/services/ai/prompts/common';

/**
 * Baseline estimation for prescribed plan items (product spec § 6 "Review
 * rules"): nutrition per item index, from the prescribed food and portion
 * only. Reply validated with `planBaselineOutputSchema`.
 */
export const PLAN_BASELINE_PROMPT_VERSION = 2;
export const PLAN_BASELINE_MAX_TOKENS = 6000;

const EXAMPLE = {
  items: [
    {
      index: 0,
      nutrition: {
        basis: 'PER_RECORDED_PORTION',
        basisQuantity: 2,
        basisUnit: 'piece',
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
      unitGrams: 50,
    },
    { index: 1, nutrition: null, unitGrams: null },
  ],
};

export function planBaselineSystemPrompt(): string {
  return [
    marker('PLAN_BASELINE', PLAN_BASELINE_PROMPT_VERSION),
    'You estimate the nutrition of foods prescribed by a diet plan, exactly as prescribed (food, quantity, unit, preparation). You describe the supplied diet; you never change it, add to it, or derive anything from a health profile.',
    DATA_NOTICE,
    LANGUAGE_RULES,
    unitsSection(),
    NUTRITION_SHAPE,
    'Return one entry per input item, keyed by its `index`. For an item whose quantity is null or whose unit cannot be resolved to a weight or volume, return `nutrition: null` rather than guessing a portion. `unitGrams`: for an item with a count unit, the grams of one unit as described above (keep the input value when it has one); null for other units. Prefer typical values for the regional dish as commonly prepared (Iranian and Middle Eastern foods included).',
    '',
    'Example of the exact json shape to return (values are illustrative):',
    JSON.stringify(EXAMPLE, null, 1),
  ].join('\n');
}

export function planBaselineUserMessage(items: BaselineItemInput[]): string {
  return ['Items (data):', asJson(items)].join('\n');
}
