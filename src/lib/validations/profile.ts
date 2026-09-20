import { z } from 'zod';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { isValidLocalDate } from '@/lib/time/local-date';

/**
 * Onboarding steps and profile fields (product spec § 5). Numeric fields
 * accept Persian and Arabic digits; values are stored in metric.
 */
export const numberInput = z.preprocess(
  (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;
    const cleaned = normalizeDigits(value).replace(/,/g, '').trim();
    if (cleaned === '') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : value;
  },
  z.number({ message: t('validation.numberRequired') }),
);

export const MIN_AGE = 18;

export const ageSchema = z.object({
  ageYears: numberInput.pipe(
    z
      .number()
      .int(t('validation.ageWhole'))
      .min(1, t('validation.ageRange'))
      .max(120, t('validation.ageRange')),
  ),
});

export const sexSchema = z.object({
  sex: z.enum(['FEMALE', 'MALE'], { message: t('validation.required') }),
});

export const unitSystemSchema = z.enum(['METRIC', 'IMPERIAL']);

export const heightSchema = z.object({
  heightCm: numberInput.pipe(
    z.number().min(100, t('validation.heightRange')).max(250, t('validation.heightRange')),
  ),
  unitSystem: unitSystemSchema.default('METRIC'),
});

export const weightSchema = z.object({
  weightKg: numberInput.pipe(
    z.number().min(30, t('validation.weightRange')).max(300, t('validation.weightRange')),
  ),
  unitSystem: unitSystemSchema.default('METRIC'),
});

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(40, t('validation.displayNameMax', { max: 40 }))
    .optional()
    .transform((v) => (v ? v : null)),
});

export const ONBOARDING_INPUT_STEPS = ['AGE', 'SEX', 'HEIGHT', 'WEIGHT', 'DISPLAY_NAME'] as const;
export type OnboardingInputStep = (typeof ONBOARDING_INPUT_STEPS)[number];

export const onboardingStepSchema = z.enum(ONBOARDING_INPUT_STEPS);

export const STEP_SCHEMAS = {
  AGE: ageSchema,
  SEX: sexSchema,
  HEIGHT: heightSchema,
  WEIGHT: weightSchema,
  DISPLAY_NAME: displayNameSchema,
} as const;

export type StepValues = {
  AGE: z.infer<typeof ageSchema>;
  SEX: z.infer<typeof sexSchema>;
  HEIGHT: z.infer<typeof heightSchema>;
  WEIGHT: z.infer<typeof weightSchema>;
  DISPLAY_NAME: z.infer<typeof displayNameSchema>;
};

/** Settings › Profile. */
export const updateProfileSchema = z.object({
  ageYears: ageSchema.shape.ageYears,
  sex: sexSchema.shape.sex,
  heightCm: heightSchema.shape.heightCm,
  weightKg: weightSchema.shape.weightKg,
  weightMeasuredAt: z.string().refine(isValidLocalDate, t('validation.dateInvalid')),
  displayName: displayNameSchema.shape.displayName,
  goal: z
    .string()
    .trim()
    .max(200, t('validation.goalMax', { max: 200 }))
    .optional()
    .transform((v) => (v ? v : null)),
  /** One restriction per line, verbatim. */
  restrictions: z.array(z.string().trim().max(60)).max(30).default([]),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Settings › Preferences. */
export const updatePreferencesSchema = z.object({
  unitSystem: unitSystemSchema.optional(),
  weekStart: z.number().int().min(0).max(6).optional(),
  appearance: z.enum(['SYSTEM', 'LIGHT', 'DARK']).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const aiNoticeKindSchema = z.enum(['PLAN', 'MEAL_TEXT', 'MEAL_PHOTO']);
export type AiNoticeKind = z.infer<typeof aiNoticeKindSchema>;

/** Unit conversions for the toggles: display only, storage stays metric. */
export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;
