import { z } from 'zod';
import { t } from '@/lib/t';
import { isValidLocalTime } from '@/lib/time/local-date';
import { UNIT_KEYS, withLegacyUnit } from '@/lib/units';
import { nutritionSchema } from '@/lib/validations/nutrition';

/**
 * The plan draft (tech spec § 5 `Plan.draftJson`) — one shape for import
 * results, manual setup and edit drafts, and the payloads of
 * `updatePlanDraftAction`. Every slot/option/item carries a client `key`
 * (stable inside the draft) and, for rows copied from the active plan, its
 * database `id`; confirm updates rows with an id in place and inserts the rest
 * (implementation plan § 5 task 4.2, review finding 3).
 */

export const PLAN_TEXT_MAX = 20_000;

export const FOOD_CATEGORIES = [
  'OIL',
  'BREAD',
  'RICE',
  'POTATO',
  'NUTS',
  'DAIRY',
  'MEAT',
  'VEGETABLE',
  'HERB',
  'CONDIMENT',
  'FRUIT',
  'OTHER',
] as const;
export const PLAN_STRUCTURES = ['SAME_EVERY_DAY', 'BY_WEEKDAY', 'TARGETS_ONLY'] as const;
export const TARGET_NUTRIENTS = [
  'ENERGY_KCAL',
  'PROTEIN_G',
  'CARB_G',
  'FAT_G',
  'FIBER_G',
  'SODIUM_MG',
] as const;
export const TARGET_TYPES = ['RANGE', 'MINIMUM', 'MAXIMUM', 'DESIRED', 'APPROXIMATE'] as const;
export const TARGET_SOURCES = ['EXPLICIT', 'ESTIMATED', 'SUM_OF_MEALS'] as const;
export const RULE_KINDS = [
  'SERVING_COUNT',
  'DISTINCT_GROUPS',
  'NAMED_WEEKDAY_FOOD',
  'EXCLUSION',
  'TIMING_WINDOW',
  'INSTRUCTION',
] as const;
export const RULE_TRACKING = ['TRACK', 'NOTE', 'IGNORE'] as const;
export const RULE_PERIODS = ['DAY', 'WEEK'] as const;
export const NOTE_REASONS = [
  'TRAINING_CONDITIONAL',
  'EXERCISE',
  'FASTING',
  'DAY_TYPE',
  'UNSUPPORTED_SCHEDULE',
  'OTHER',
] as const;

/** 0–6 = Sunday–Saturday, 7 = every day. */
export const EVERY_DAY = 7;

const key = z.string().min(1).max(64);
const optionalId = z.string().min(1).optional();
const shortText = z.string().trim().max(200);
const excerpt = z.string().max(2000).default('');
const localTime = z
  .string()
  .refine(isValidLocalTime, t('validation.timeInvalid'))
  .nullable()
  .default(null);
/** Unit-table keys, or a free-text unit the user typed (kept, but not convertible). */
export const unitSchema = z.string().trim().max(40).nullable().default(null);
/**
 * Grams of one unit when `unit` is a count unit (decision 024). The AI fills
 * it for every counted item it quantifies; the user can edit it. Null for
 * mass and volume units, and for a count the model could not weigh.
 */
export const unitGramsSchema = z.number().finite().positive().max(100_000).nullable().default(null);
export const quantitySchema = z
  .number()
  .finite()
  .nonnegative()
  .max(100_000)
  .nullable()
  .default(null);

export const foodNameSchema = z.object({
  originalName: z.string().trim().min(1, t('validation.required')).max(200),
  englishLabel: z.string().trim().min(1, t('validation.required')).max(200),
});

export const alternativeSchema = foodNameSchema.extend({
  nutrition: nutritionSchema.nullable().default(null),
});

/** A draft written before decision 024 may name an old unit key; it is mapped on read. */
export const draftItemSchema = z.preprocess(
  withLegacyUnit,
  foodNameSchema.extend({
    key,
    id: optionalId,
    position: z.number().int().nonnegative().default(0),
    quantity: quantitySchema,
    unit: unitSchema,
    unitGrams: unitGramsSchema,
    quantityAssumed: z.boolean().default(false),
    assumedDefaultKey: z.string().max(60).nullable().default(null),
    preparationNote: shortText.nullable().default(null),
    alternatives: z.array(alternativeSchema).max(6).default([]),
    category: z.enum(FOOD_CATEGORIES).default('OTHER'),
    nutrition: nutritionSchema.nullable().default(null),
    sourceExcerpt: excerpt,
    /** Set when identity/quantity changed after the last estimate; 8b re-estimates these. */
    needsEstimate: z.boolean().default(false),
  }),
);
export type DraftItem = z.infer<typeof draftItemSchema>;

export const draftOptionSchema = z.object({
  key,
  id: optionalId,
  position: z.number().int().nonnegative().default(0),
  label: shortText.nullable().default(null),
  items: z.array(draftItemSchema).max(40).default([]),
});
export type DraftOption = z.infer<typeof draftOptionSchema>;

export const draftSlotSchema = foodNameSchema.extend({
  key,
  id: optionalId,
  weekday: z.number().int().min(0).max(EVERY_DAY),
  position: z.number().int().nonnegative().default(0),
  timeStart: localTime,
  timeEnd: localTime,
  sourceExcerpt: excerpt,
  options: z.array(draftOptionSchema).min(1).max(12),
  /** Weekday plans: the summary screen asks to apply the same checks to the other days. */
  reviewed: z.boolean().default(false),
});
export type DraftSlot = z.infer<typeof draftSlotSchema>;

export const draftTargetSchema = z
  .object({
    key,
    /** Null = daily target; otherwise the slot's draft key. */
    slotKey: key.nullable().default(null),
    weekday: z.number().int().min(0).max(EVERY_DAY).nullable().default(null),
    nutrient: z.enum(TARGET_NUTRIENTS),
    type: z.enum(TARGET_TYPES),
    low: z.number().finite().nonnegative().nullable().default(null),
    high: z.number().finite().nonnegative().nullable().default(null),
    source: z.enum(TARGET_SOURCES).default('EXPLICIT'),
    sourceExcerpt: z.string().max(2000).nullable().default(null),
  })
  .superRefine((target, ctx) => {
    const { type, low, high } = target;
    const need = (ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', message, path: ['low'] });
    };
    if (type === 'RANGE')
      need(low !== null && high !== null && low <= high, t('validation.targetRange'));
    if (type === 'MINIMUM') need(low !== null, t('validation.targetValue'));
    if (type === 'MAXIMUM') need(high !== null, t('validation.targetValue'));
    if (type === 'DESIRED' || type === 'APPROXIMATE')
      need(low !== null, t('validation.targetValue'));
  });
export type DraftTarget = z.infer<typeof draftTargetSchema>;

// ─── Rule definitions per kind (tech spec § 7.1 / implementation plan 7.1) ──

const ruleFoodSchema = foodNameSchema.extend({
  synonyms: z.array(z.string().trim().max(100)).max(10).default([]),
});

export const servingCountDefinitionSchema = z.object({
  food: ruleFoodSchema,
  count: z.number().int().positive(),
  comparator: z.enum(['AT_LEAST', 'AT_MOST', 'EXACT']).default('AT_LEAST'),
});
export const distinctGroupsDefinitionSchema = z.object({
  groups: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  minimum: z.number().int().positive(),
});
export const namedWeekdayFoodDefinitionSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  food: ruleFoodSchema,
});
export const exclusionDefinitionSchema = z.object({
  foods: z.array(ruleFoodSchema).min(1).max(20),
});
export const timingWindowDefinitionSchema = z.object({
  /** The slot's draft key (mapped to the slot id at confirm). */
  slotKey: key.nullable().default(null),
  slotId: z.string().nullable().default(null),
  start: z.string().refine(isValidLocalTime),
  end: z.string().refine(isValidLocalTime).nullable().default(null),
});
export const instructionDefinitionSchema = z.object({}).passthrough();

export const RULE_DEFINITION_SCHEMAS = {
  SERVING_COUNT: servingCountDefinitionSchema,
  DISTINCT_GROUPS: distinctGroupsDefinitionSchema,
  NAMED_WEEKDAY_FOOD: namedWeekdayFoodDefinitionSchema,
  EXCLUSION: exclusionDefinitionSchema,
  TIMING_WINDOW: timingWindowDefinitionSchema,
  INSTRUCTION: instructionDefinitionSchema,
} as const;

export const draftRuleSchema = z
  .object({
    key,
    id: optionalId,
    kind: z.enum(RULE_KINDS),
    tracking: z.enum(RULE_TRACKING).default('NOTE'),
    period: z.enum(RULE_PERIODS).nullable().default(null),
    definition: z.unknown().default({}),
    originalText: z.string().trim().min(1).max(2000),
    sourceExcerpt: excerpt,
    isConflicting: z.boolean().default(false),
    unsupportedReason: z.string().max(300).nullable().default(null),
  })
  .superRefine((rule, ctx) => {
    // A tracked rule must carry a valid definition for its kind; notes and ignored rules may be loose.
    if (rule.tracking !== 'TRACK') return;
    const schema = RULE_DEFINITION_SCHEMAS[rule.kind];
    const parsed = schema.safeParse(rule.definition ?? {});
    if (!parsed.success)
      ctx.addIssue({
        code: 'custom',
        path: ['definition'],
        message: t('validation.ruleDefinition'),
      });
  });
export type DraftRule = z.infer<typeof draftRuleSchema>;

export const draftNoteSchema = z.object({
  key,
  originalText: z.string().trim().min(1).max(2000),
  reason: z.enum(NOTE_REASONS).default('OTHER'),
});
export type DraftNote = z.infer<typeof draftNoteSchema>;

/** A calorie-significant unknown asked on screen 8a (at most one per screen). */
export const draftQuestionSchema = z.object({
  key,
  slotKey: key,
  itemKey: key,
  question: z.string().trim().min(1).max(300),
  answered: z.boolean().default(false),
});
export type DraftQuestion = z.infer<typeof draftQuestionSchema>;

export const planDraftSchema = z.object({
  draftRevision: z.number().int().nonnegative().default(0),
  structure: z.enum(PLAN_STRUCTURES),
  name: shortText.nullable().default(null),
  sourceNote: shortText.nullable().default(null),
  sourceLanguage: z.string().trim().max(20).nullable().default(null),
  slots: z.array(draftSlotSchema).max(60).default([]),
  targets: z.array(draftTargetSchema).max(200).default([]),
  rules: z.array(draftRuleSchema).max(60).default([]),
  notes: z.array(draftNoteSchema).max(60).default([]),
  questions: z.array(draftQuestionSchema).max(60).default([]),
  /** Review progress (8a → 8b → 8c). */
  reviewed: z
    .object({
      meals: z.boolean().default(false),
      targets: z.boolean().default(false),
      rules: z.boolean().default(false),
    })
    .default({ meals: false, targets: false, rules: false }),
  /** Manual setup: how far the wizard got, so a refresh resumes there. */
  manualStep: z.string().max(40).nullable().default(null),
});
export type PlanDraft = z.infer<typeof planDraftSchema>;

// ─── Action inputs ─────────────────────────────────────────────────────────

export const sourceTextSchema = z.object({
  /** Counted on the verbatim text; over-limit text is refused but kept on screen. */
  sourceText: z
    .string()
    .min(1, t('validation.required'))
    .max(PLAN_TEXT_MAX, t('plan.errors.textTooLong')),
});

export const startManualPlanSchema = z.object({
  structure: z.enum(PLAN_STRUCTURES),
  name: shortText.optional().transform((v) => (v ? v : null)),
});

export const DRAFT_SECTIONS = [
  'meta',
  'slots',
  'slot',
  'targets',
  'rules',
  'notes',
  'questions',
  'reviewed',
  'manualStep',
] as const;
export type DraftSection = (typeof DRAFT_SECTIONS)[number];

/**
 * `updatePlanDraftAction(section, payload, draftRevision)`:
 * - meta: { name?, sourceNote?, sourceLanguage?, structure? }
 * - slots: the whole slots array (manual setup, reorder, remove)
 * - slot: one slot by key (8a "Fix"), replacing it
 * - targets / rules / notes / questions: the whole array
 * - reviewed: partial { meals?, targets?, rules? }
 * - manualStep: string | null
 */
export const updateDraftSchema = z.object({
  draftRevision: z.number().int().nonnegative(),
  section: z.enum(DRAFT_SECTIONS),
  payload: z.unknown(),
});

export const DRAFT_SECTION_PAYLOADS = {
  meta: planDraftSchema
    .pick({ name: true, sourceNote: true, sourceLanguage: true, structure: true })
    .partial(),
  slots: z.array(draftSlotSchema).max(60),
  slot: draftSlotSchema,
  targets: z.array(draftTargetSchema).max(200),
  rules: z.array(draftRuleSchema).max(60),
  notes: z.array(draftNoteSchema).max(60),
  questions: z.array(draftQuestionSchema).max(60),
  reviewed: z.object({
    meals: z.boolean().optional(),
    targets: z.boolean().optional(),
    rules: z.boolean().optional(),
  }),
  manualStep: z.string().max(40).nullable(),
} as const;

export const draftRevisionSchema = z.object({ draftRevision: z.number().int().nonnegative() });

export const deletePlanSchema = z.object({
  confirmation: z.string().trim().min(1, t('validation.required')),
});

/** Derived unique key for PlanTarget rows (tech spec § 5). */
export function targetScopeKey(
  weekday: number | null,
  planSlotId: string | null,
  nutrient: string,
): string {
  return `${weekday ?? 'all'}:${planSlotId ?? 'day'}:${nutrient}`;
}

export function isKnownUnit(unit: string | null): boolean {
  return unit !== null && UNIT_KEYS.includes(unit);
}
