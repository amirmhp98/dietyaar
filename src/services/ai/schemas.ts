import { z } from 'zod';
import {
  FOOD_CATEGORIES,
  NOTE_REASONS,
  RULE_KINDS,
  RULE_PERIODS,
  TARGET_NUTRIENTS,
  TARGET_TYPES,
  alternativeSchema,
  foodNameSchema,
  quantitySchema,
} from '@/lib/validations/plan';
import { nutritionSchema } from '@/lib/validations/nutrition';

/**
 * Zod schemas for every AI output (tech spec § 10.2). The adapter validates
 * with these; the calling service adds the post-validation checks (source
 * excerpts must be substrings of the source text, used fact ids must exist).
 * Model output is untrusted input: unknown fields are dropped, quantities are
 * non-negative, enums are closed.
 */

const excerpt = z.string().max(2000).default('');

export const aiItemSchema = foodNameSchema.extend({
  quantity: quantitySchema,
  /** A unit-table key, or a free-text unit the model could not resolve. */
  unit: z.string().trim().max(40).nullable().default(null),
  quantityAssumed: z.boolean().default(false),
  assumedDefaultKey: z.string().max(60).nullable().default(null),
  preparationNote: z.string().trim().max(200).nullable().default(null),
  alternatives: z.array(alternativeSchema).max(6).default([]),
  category: z.enum(FOOD_CATEGORIES).default('OTHER'),
  nutrition: nutritionSchema.nullable().default(null),
  sourceExcerpt: excerpt,
});

export const aiOptionSchema = z.object({
  label: z.string().trim().max(200).nullable().default(null),
  items: z.array(aiItemSchema).max(40).default([]),
});

export const aiSlotSchema = foodNameSchema.extend({
  /** 0–6 = Sunday–Saturday, 7 = every day. */
  weekday: z.number().int().min(0).max(7).default(7),
  timeStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  timeEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  sourceExcerpt: excerpt,
  options: z.array(aiOptionSchema).min(1).max(12),
});

export const aiTargetSchema = z.object({
  /** Index into `slots` of this chunk, or null for a daily target. */
  slotIndex: z.number().int().nonnegative().nullable().default(null),
  weekday: z.number().int().min(0).max(7).nullable().default(null),
  nutrient: z.enum(TARGET_NUTRIENTS),
  type: z.enum(TARGET_TYPES),
  low: z.number().finite().nonnegative().nullable().default(null),
  high: z.number().finite().nonnegative().nullable().default(null),
  sourceExcerpt: z.string().max(2000).nullable().default(null),
});

export const aiRuleSchema = z.object({
  kind: z.enum(RULE_KINDS),
  period: z.enum(RULE_PERIODS).nullable().default(null),
  definition: z.unknown().default({}),
  originalText: z.string().trim().min(1).max(2000),
  sourceExcerpt: excerpt,
  isConflicting: z.boolean().default(false),
  unsupportedReason: z.string().max(300).nullable().default(null),
});

export const aiNoteSchema = z.object({
  originalText: z.string().trim().min(1).max(2000),
  reason: z.enum(NOTE_REASONS).default('OTHER'),
});

export const aiUncertaintySchema = z.object({
  slotIndex: z.number().int().nonnegative(),
  optionIndex: z.number().int().nonnegative().default(0),
  itemIndex: z.number().int().nonnegative(),
  question: z.string().trim().min(1).max(300),
});

/** One chunk of a plan import (whole plan, or one weekday of a BY_WEEKDAY plan). */
export const planImportOutputSchema = z.object({
  structure: z.enum(['SAME_EVERY_DAY', 'BY_WEEKDAY', 'TARGETS_ONLY']),
  name: z.string().trim().max(200).nullable().default(null),
  sourceLanguage: z.string().trim().max(20).nullable().default(null),
  slots: z.array(aiSlotSchema).max(60).default([]),
  targets: z.array(aiTargetSchema).max(200).default([]),
  rules: z.array(aiRuleSchema).max(60).default([]),
  notes: z.array(aiNoteSchema).max(60).default([]),
  uncertainties: z.array(aiUncertaintySchema).max(60).default([]),
});
export type PlanImportOutput = z.infer<typeof planImportOutputSchema>;

/** Baseline estimation: nutrition per requested item, by index. */
export const planBaselineOutputSchema = z.object({
  items: z
    .array(
      z.object({ index: z.number().int().nonnegative(), nutrition: nutritionSchema.nullable() }),
    )
    .max(200),
});
export type PlanBaselineOutput = z.infer<typeof planBaselineOutputSchema>;

export const aiMealItemSchema = foodNameSchema.extend({
  quantity: quantitySchema,
  unit: z.string().trim().max(40).nullable().default(null),
  quantityUnknown: z.boolean().default(false),
  quantityAssumed: z.boolean().default(false),
  preparation: z.string().trim().max(200).nullable().default(null),
  category: z.enum(FOOD_CATEGORIES).default('OTHER'),
  alternatives: z.array(alternativeSchema).max(6).default([]),
  nutrition: nutritionSchema.nullable().default(null),
});

export const aiMealQuestionSchema = z.object({
  /** Index into `items`, or null for the whole meal. */
  itemIndex: z.number().int().nonnegative().nullable().default(null),
  question: z.string().trim().min(1).max(300),
  kind: z.enum(['PORTION', 'INGREDIENT', 'PREPARATION', 'OTHER']).default('OTHER'),
  /** Optional quick answers, e.g. "about a quarter", "half", "all of it". */
  choices: z.array(z.string().trim().max(60)).max(6).default([]),
});

export const mealAnalysisOutputSchema = z.object({
  items: z.array(aiMealItemSchema).max(40),
  /** Names of the plan slot / option the meal most likely belongs to, or null. */
  suggestedSlot: foodNameSchema.nullable().default(null),
  suggestedOptionIndex: z.number().int().nonnegative().nullable().default(null),
  questions: z.array(aiMealQuestionSchema).max(6).default([]),
  /** REFINE mode only: one English sentence per item the answers changed. */
  changes: z.array(z.string().trim().max(200)).max(20).default([]),
});
export type MealAnalysisOutput = z.infer<typeof mealAnalysisOutputSchema>;

export const reflectionOutputSchema = z.object({
  paragraph: z.string().trim().min(1).max(1500),
  usedFactIds: z.array(z.string().min(1).max(80)).max(40).default([]),
});
export type ReflectionOutput = z.infer<typeof reflectionOutputSchema>;

/** Counts words; the reflection must be 40–110 words (tech spec § 10.2). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
