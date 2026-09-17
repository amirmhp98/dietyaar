import { z } from 'zod';

/**
 * Tech spec § 5.1: the nutrition JSON stored on PlanItem, FoodItem and inside
 * `alternatives`. Also the shape the AI adapter must return for every item.
 * Unknown values are `null`, never 0.
 */
export const NUTRIENT_KEYS = [
  'ENERGY_KCAL',
  'PROTEIN_G',
  'CARB_G',
  'FAT_G',
  'FIBER_G',
  'SODIUM_MG',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** The four nutrients every summary shows first (product spec § 7). */
export const MAIN_NUTRIENTS = ['ENERGY_KCAL', 'PROTEIN_G', 'CARB_G', 'FAT_G'] as const;

const nutrientValue = z
  .number()
  .finite()
  .min(0)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const nutritionValuesSchema = z.object({
  ENERGY_KCAL: nutrientValue,
  PROTEIN_G: nutrientValue,
  CARB_G: nutrientValue,
  FAT_G: nutrientValue,
  FIBER_G: nutrientValue,
  SODIUM_MG: nutrientValue,
});
export type NutritionValues = z.infer<typeof nutritionValuesSchema>;

export const nutritionSchema = z.object({
  basis: z.enum(['PER_RECORDED_PORTION', 'PER_100G']),
  basisQuantity: z.number().finite().positive().nullable().default(null),
  basisUnit: z.string().nullable().default(null),
  values: nutritionValuesSchema,
  source: z.enum(['AI_ESTIMATE', 'USDA', 'USER_LABEL', 'RECIPE']),
  sourceRef: z.string().nullable().default(null),
  isEstimate: z.boolean().default(true),
  userOverride: z.boolean().default(false),
});
export type Nutrition = z.infer<typeof nutritionSchema>;

export const EMPTY_VALUES: NutritionValues = {
  ENERGY_KCAL: null,
  PROTEIN_G: null,
  CARB_G: null,
  FAT_G: null,
  FIBER_G: null,
  SODIUM_MG: null,
};
