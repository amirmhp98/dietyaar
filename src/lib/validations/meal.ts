import { z } from 'zod';
import type { RubricFoodItem } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { isValidLocalDate, isValidLocalTime } from '@/lib/time/local-date';
import { withLegacyUnit } from '@/lib/units';
import {
  FOOD_CATEGORIES,
  alternativeSchema,
  foodNameSchema,
  quantitySchema,
  unitGramsSchema,
  unitSchema,
} from '@/lib/validations/plan';
import { nutritionSchema } from '@/lib/validations/nutrition';

/**
 * Meal drafts, saves and edits (tech spec § 5 MealDraft, § 7 "Meal" actions).
 * The draft is server-held; the client sends edits with the expected revision.
 */
export const MEAL_TEXT_MAX = 2_000;
export const MEAL_INPUT_KINDS = [
  'TEXT',
  'PHOTO',
  'PHOTO_TEXT',
  'RECENT',
  'PLANNED',
  'MANUAL',
] as const;

const key = z.string().min(1).max(64);
export const clientRequestIdSchema = z.string().uuid(t('validation.invalid'));
export const localDateSchema = z.string().refine(isValidLocalDate, t('validation.dateInvalid'));
export const localTimeSchema = z.string().refine(isValidLocalTime, t('validation.timeInvalid'));

export const draftFoodItemSchema = z.preprocess(
  withLegacyUnit,
  foodNameSchema.extend({
    key,
    position: z.number().int().nonnegative().default(0),
    quantity: quantitySchema,
    unit: unitSchema,
    unitGrams: unitGramsSchema,
    quantityUnknown: z.boolean().default(false),
    quantityAssumed: z.boolean().default(false),
    preparation: z.string().trim().max(200).nullable().default(null),
    category: z.enum(FOOD_CATEGORIES).default('OTHER'),
    alternatives: z.array(alternativeSchema).max(6).default([]),
    /** The chosen in-item alternative, by index into `alternatives`, or null for the item itself. */
    chosenAlternative: z.number().int().nonnegative().nullable().default(null),
    nutrition: nutritionSchema.nullable().default(null),
    matchedPlanItemId: z.string().nullable().default(null),
    isAddedItem: z.boolean().default(false),
    /** Identity or preparation changed since the last estimate (tech spec § 5.1). */
    needsReestimate: z.boolean().default(false),
    /** Previous values shown struck through until re-estimated. */
    previousNutrition: nutritionSchema.nullable().default(null),
    scaleFlag: z
      .enum(['SCALED', 'UNCHANGED', 'CHECK_VALUE', 'NEEDS_REESTIMATE', 'NOT_EVALUATED'])
      .nullable()
      .default(null),
    ruleGroups: z.array(z.string().max(60)).max(10).default([]),
  }),
);
export type DraftFoodItem = z.infer<typeof draftFoodItemSchema>;

/** A draft item in the rubric's shape, so the review and the service apply the same rules to it. */
export function toRubricItem(item: DraftFoodItem): RubricFoodItem {
  return {
    id: item.key,
    originalName: item.originalName,
    englishLabel: item.englishLabel,
    quantity: item.quantity,
    unit: item.unit,
    unitGrams: item.unitGrams,
    quantityUnknown: item.quantityUnknown,
    category: item.category,
    alternatives: item.alternatives,
    matchedPlanItemId: item.matchedPlanItemId,
    isAddedItem: item.isAddedItem,
    nutrition: item.nutrition,
    ruleGroups: item.ruleGroups,
  };
}

export const draftQuestionSchema = z.object({
  key,
  itemKey: key.nullable().default(null),
  question: z.string().trim().min(1).max(300),
  kind: z.enum(['PORTION', 'INGREDIENT', 'PREPARATION', 'OTHER']).default('OTHER'),
  choices: z.array(z.string().max(60)).max(6).default([]),
  answer: z.string().trim().max(300).nullable().default(null),
});
export type DraftQuestion = z.infer<typeof draftQuestionSchema>;

/** `MealDraft.state`. */
export const mealDraftStateSchema = z.object({
  kind: z.enum(MEAL_INPUT_KINDS),
  text: z.string().max(MEAL_TEXT_MAX).nullable().default(null),
  uploadIds: z.array(z.string()).max(3).default([]),
  localDate: localDateSchema,
  /** null = time unknown ("I don't remember the time"). */
  time: localTimeSchema.nullable().default(null),
  planSlotId: z.string().nullable().default(null),
  planOptionId: z.string().nullable().default(null),
  notes: z.string().trim().max(1000).nullable().default(null),
  items: z.array(draftFoodItemSchema).max(40).default([]),
  questions: z.array(draftQuestionSchema).max(6).default([]),
  copiedFromMealId: z.string().nullable().default(null),
  /** Neutral reminders computed on the server from Settings restrictions. */
  restrictionHits: z.array(z.object({ itemKey: key, restriction: z.string().max(60) })).default([]),
  /** What the last REFINE changed, in the model's words; cleared by the next edit. */
  lastChanges: z.array(z.string().max(200)).max(20).default([]),
});
export type MealDraftState = z.infer<typeof mealDraftStateSchema>;

export const createMealDraftSchema = z.object({
  clientRequestId: clientRequestIdSchema,
  kind: z.enum(MEAL_INPUT_KINDS),
  text: z
    .string()
    .max(MEAL_TEXT_MAX, t('meal.errors.textTooLong'))
    .optional()
    .transform((v) => (v?.trim() ? v : null)),
  uploadIds: z.array(z.string()).max(3).default([]),
  localDate: localDateSchema,
  time: localTimeSchema.nullable().default(null),
  planSlotId: z.string().nullable().default(null),
  planOptionId: z.string().nullable().default(null),
  /** RECENT: the meal to copy. */
  copiedFromMealId: z.string().nullable().default(null),
});
export type CreateMealDraftInput = z.infer<typeof createMealDraftSchema>;

/** Review edits; every field optional, arrays replace wholesale. */
export const mealDraftEditsSchema = z.object({
  text: z.string().max(MEAL_TEXT_MAX).nullable().optional(),
  localDate: localDateSchema.optional(),
  time: localTimeSchema.nullable().optional(),
  planSlotId: z.string().nullable().optional(),
  planOptionId: z.string().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(draftFoodItemSchema).max(40).optional(),
  questions: z.array(draftQuestionSchema).max(6).optional(),
  uploadIds: z.array(z.string()).max(3).optional(),
});
export type MealDraftEdits = z.infer<typeof mealDraftEditsSchema>;

export const updateMealDraftSchema = z.object({
  draftId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  edits: mealDraftEditsSchema,
});

export const MEAL_ANALYSIS_MODES = ['ANALYZE', 'REFINE'] as const;
export type MealAnalysisMode = (typeof MEAL_ANALYSIS_MODES)[number];

export const analyzeMealDraftSchema = z.object({
  draftId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  /** REFINE keeps the current items and fills what the answers now make known. */
  mode: z.enum(MEAL_ANALYSIS_MODES).default('ANALYZE'),
});

export const discardMealDraftSchema = z.object({ draftId: z.string().min(1) });

export const saveMealSchema = z.object({
  draftId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  clientRequestId: clientRequestIdSchema,
});

/** Edits to a confirmed meal (MealReview in "edit" mode). */
export const mealEditsSchema = z.object({
  time: localTimeSchema.nullable().optional(),
  localDate: localDateSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(draftFoodItemSchema).max(40).optional(),
});

export const updateMealSchema = z.object({
  mealId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  edits: mealEditsSchema,
});

export const deleteMealSchema = z.object({
  mealId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
});

export const setMealLinkSchema = z.object({
  mealId: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  planSlotId: z.string().nullable(),
  planOptionId: z.string().nullable(),
});

export const reuseMealSchema = z.object({
  mealId: z.string().min(1),
  clientRequestId: clientRequestIdSchema,
  localDate: localDateSchema,
});

export const mealIdSchema = z.object({ mealId: z.string().min(1) });
export const uploadIdSchema = z.object({ uploadId: z.string().min(1) });

export const markSlotSkippedSchema = z.object({
  localDate: localDateSchema,
  planSlotId: z.string().min(1),
  skipped: z.boolean(),
});

export const setDayCompletenessSchema = z.object({
  localDate: localDateSchema,
  complete: z.boolean(),
});
