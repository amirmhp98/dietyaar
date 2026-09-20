import type { OnboardingStep, Prisma, Profile } from '@prisma/client';
import { ServiceError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/t';
import { normalizeInput } from '@/lib/text/normalize';
import { localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import {
  MIN_AGE,
  type AiNoticeKind,
  type OnboardingInputStep,
  type StepValues,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
} from '@/lib/validations/profile';

/**
 * Profile module (tech spec § 4): onboarding steps and resume, profile,
 * preferences, AI-notice flags. Every function takes the owner id first.
 */

/** Plain-number projection of a Profile row (Decimals converted at the boundary). */
export interface ProfileView {
  ageYears: number | null;
  sex: 'FEMALE' | 'MALE' | null;
  heightCm: number | null;
  weightKg: number | null;
  weightMeasuredAt: string | null;
  unitSystem: 'METRIC' | 'IMPERIAL';
  weekStart: number;
  appearance: 'SYSTEM' | 'LIGHT' | 'DARK';
  displayName: string | null;
  goal: string | null;
  restrictions: string[];
  restrictionsOriginal: string[];
  aiNoticePlanShownAt: Date | null;
  aiNoticeMealTextShownAt: Date | null;
  aiNoticePhotoShownAt: Date | null;
  completedAt: Date | null;
  /** The row's creation, the first onboarding answer: the account's first day for history. */
  createdAt: Date;
}

/** Saturday, until the plan or the user sets it (product spec § 6). */
export const DEFAULT_WEEK_START = 6;

export function toProfileView(row: Profile): ProfileView {
  return {
    ageYears: row.ageYears,
    sex: row.sex,
    heightCm: row.heightCm === null ? null : Number(row.heightCm),
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
    weightMeasuredAt: row.weightMeasuredAt,
    unitSystem: row.unitSystem,
    weekStart: row.weekStart ?? DEFAULT_WEEK_START,
    appearance: row.appearance,
    displayName: row.displayName,
    goal: row.goal,
    restrictions: row.restrictions,
    restrictionsOriginal: row.restrictionsOriginal,
    aiNoticePlanShownAt: row.aiNoticePlanShownAt,
    aiNoticeMealTextShownAt: row.aiNoticeMealTextShownAt,
    aiNoticePhotoShownAt: row.aiNoticePhotoShownAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

export async function getProfile(ownerId: string): Promise<ProfileView | null> {
  const row = await prisma.profile.findUnique({ where: { userId: ownerId } });
  return row ? toProfileView(row) : null;
}

/** The profile a product page needs; a DONE user always has one (review finding 8). */
export async function requireProfile(ownerId: string): Promise<ProfileView> {
  const profile = await getProfile(ownerId);
  if (!profile) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  return profile;
}

export function greetingNameFor(
  profile: Pick<ProfileView, 'displayName'> | null,
  user: { username: string },
): string {
  return profile?.displayName?.trim() || user.username;
}

// ─── Onboarding ────────────────────────────────────────────────────────────

const NEXT_STEP: Record<OnboardingInputStep, OnboardingStep> = {
  AGE: 'SEX',
  SEX: 'HEIGHT',
  HEIGHT: 'WEIGHT',
  WEIGHT: 'DISPLAY_NAME',
  DISPLAY_NAME: 'PLAN',
};

const STEP_ORDER: OnboardingStep[] = [
  'AGE',
  'SEX',
  'HEIGHT',
  'WEIGHT',
  'DISPLAY_NAME',
  'PLAN',
  'REVIEW',
  'READY',
  'DONE',
];

export function stepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

export interface OnboardingState {
  step: OnboardingStep;
  values: {
    ageYears: number | null;
    sex: 'FEMALE' | 'MALE' | null;
    heightCm: number | null;
    weightKg: number | null;
    unitSystem: 'METRIC' | 'IMPERIAL';
    displayName: string | null;
  };
}

export async function getOnboardingState(ownerId: string): Promise<OnboardingState> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { onboardingStep: true, profile: true },
  });
  if (!user) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  const p = user.profile;
  return {
    step: user.onboardingStep,
    values: {
      ageYears: p?.ageYears ?? null,
      sex: p?.sex ?? null,
      heightCm: p?.heightCm === null || p?.heightCm === undefined ? null : Number(p.heightCm),
      weightKg: p?.weightKg === null || p?.weightKg === undefined ? null : Number(p.weightKg),
      unitSystem: p?.unitSystem ?? 'METRIC',
      displayName: p?.displayName ?? null,
    },
  };
}

export type SaveStepResult = { nextStep: OnboardingStep } | { underage: true };

/**
 * Persists one answer and advances the resume pointer (implementation plan
 * § 5 task 2.2 transition table). Age is validated and never written when
 * under 18; an accepted age creates the Profile row. The pointer only moves
 * forward, so re-answering an earlier step on "Back" keeps the user's place.
 */
export async function saveOnboardingStep<S extends OnboardingInputStep>(
  ownerId: string,
  step: S,
  values: StepValues[S],
  now = new Date(),
): Promise<SaveStepResult> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { onboardingStep: true, profile: { select: { id: true } } },
  });
  if (!user) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');

  let data: Prisma.ProfileUncheckedCreateInput & Prisma.ProfileUncheckedUpdateInput;
  switch (step) {
    case 'AGE': {
      const { ageYears } = values as StepValues['AGE'];
      if (ageYears < MIN_AGE) return { underage: true };
      data = { userId: ownerId, ageYears };
      break;
    }
    case 'SEX':
      data = { userId: ownerId, sex: (values as StepValues['SEX']).sex };
      break;
    case 'HEIGHT': {
      const v = values as StepValues['HEIGHT'];
      data = { userId: ownerId, heightCm: v.heightCm, unitSystem: v.unitSystem };
      break;
    }
    case 'WEIGHT': {
      const v = values as StepValues['WEIGHT'];
      // Weight measured "today" in the app zone.
      data = {
        userId: ownerId,
        weightKg: v.weightKg,
        unitSystem: v.unitSystem,
        weightMeasuredAt: localDateFor(now, APP_TIME_ZONE),
      };
      break;
    }
    case 'DISPLAY_NAME':
      data = {
        userId: ownerId,
        displayName: (values as StepValues['DISPLAY_NAME']).displayName ?? null,
      };
      break;
    default:
      throw new ServiceError(t('validation.invalid'), 'INVALID_STEP');
  }
  if (step !== 'AGE' && !user.profile) {
    // Answers arrive in order; without the age row nothing else may be stored.
    throw new ServiceError(t('validation.invalid'), 'AGE_FIRST');
  }

  const profile = await prisma.profile.upsert({
    where: { userId: ownerId },
    create: data as Prisma.ProfileUncheckedCreateInput,
    update: data as Prisma.ProfileUncheckedUpdateInput,
  });

  const required =
    profile.ageYears !== null &&
    profile.sex !== null &&
    profile.heightCm !== null &&
    profile.weightKg !== null;
  const candidate = NEXT_STEP[step];
  const nextStep =
    stepIndex(candidate) > stepIndex(user.onboardingStep) ? candidate : user.onboardingStep;
  await prisma.$transaction([
    prisma.user.update({ where: { id: ownerId }, data: { onboardingStep: nextStep } }),
    ...(required && step === 'DISPLAY_NAME' && !profile.completedAt
      ? [prisma.profile.update({ where: { userId: ownerId }, data: { completedAt: now } })]
      : []),
  ]);
  return { nextStep };
}

/** Advances the pointer for the plan-side steps (PLAN → REVIEW/DONE, REVIEW → READY, READY → DONE). */
export async function setOnboardingStep(ownerId: string, step: OnboardingStep): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId: ownerId },
    select: { completedAt: true },
  });
  if (stepIndex(step) > stepIndex('DISPLAY_NAME') && !profile?.completedAt) {
    throw new ServiceError(t('onboarding.errors.incomplete'), 'PROFILE_INCOMPLETE');
  }
  await prisma.user.update({ where: { id: ownerId }, data: { onboardingStep: step } });
}

// ─── Settings ──────────────────────────────────────────────────────────────

export async function updateProfile(
  ownerId: string,
  input: UpdateProfileInput,
): Promise<ProfileView> {
  await requireProfile(ownerId);
  const restrictionsOriginal = input.restrictions.map((r) => r.trim()).filter(Boolean);
  const row = await prisma.profile.update({
    where: { userId: ownerId },
    data: {
      ageYears: input.ageYears,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      weightMeasuredAt: input.weightMeasuredAt,
      displayName: input.displayName,
      goal: input.goal,
      restrictionsOriginal,
      restrictions: restrictionsOriginal.map((r) => normalizeInput(r).toLowerCase()),
    },
  });
  return toProfileView(row);
}

export async function updatePreferences(
  ownerId: string,
  input: UpdatePreferencesInput,
): Promise<ProfileView> {
  await requireProfile(ownerId);
  const row = await prisma.profile.update({
    where: { userId: ownerId },
    data: {
      ...(input.unitSystem ? { unitSystem: input.unitSystem } : {}),
      ...(input.weekStart !== undefined ? { weekStart: input.weekStart } : {}),
      ...(input.appearance ? { appearance: input.appearance } : {}),
    },
  });
  return toProfileView(row);
}

export async function acknowledgeAiNotice(
  ownerId: string,
  kind: AiNoticeKind,
  now = new Date(),
): Promise<void> {
  const field =
    kind === 'PLAN'
      ? 'aiNoticePlanShownAt'
      : kind === 'MEAL_TEXT'
        ? 'aiNoticeMealTextShownAt'
        : 'aiNoticePhotoShownAt';
  await prisma.profile.updateMany({
    where: { userId: ownerId, [field]: null },
    data: { [field]: now },
  });
}
