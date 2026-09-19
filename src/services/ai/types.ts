import type { ReflectionFact } from '@/lib/rubric/facts';

/**
 * Shared AI contract (tech spec § 10.1). The adapter and the per-operation
 * functions return validated data plus per-attempt metadata; they persist
 * nothing (decision 012). The calling service records the AiCall row through
 * `services/ai-usage.service.ts`.
 */
export type AiKind = 'PLAN_IMPORT' | 'PLAN_BASELINE' | 'MEAL_TEXT' | 'MEAL_PHOTO' | 'REFLECTION';

export type AiFailureReason =
  | 'TIMEOUT'
  | 'INVALID_JSON'
  | 'SCHEMA_REJECTED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE';

export interface AiAttempt {
  model: string;
  durationMs: number;
  outcome: 'OK' | AiFailureReason;
  status?: number;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export type AiResult<T> =
  | { ok: true; data: T; attempts: AiAttempt[]; usage: AiUsage; model: string; durationMs: number }
  | {
      ok: false;
      reason: AiFailureReason;
      attempts: AiAttempt[];
      usage: AiUsage;
      durationMs: number;
    };

/** Profile fields allowed as context for plan import and reflection only (product spec § 5). */
export interface ProfileContext {
  ageYears: number | null;
  sex: 'FEMALE' | 'MALE' | null;
  heightCm: number | null;
  weightKg: number | null;
}

/** Absolute deadline in epoch milliseconds shared by every stage and retry of one operation. */
export type DeadlineAt = number;

export interface InterpretPlanInput {
  sourceText: string;
  profile: ProfileContext;
  deadlineAt: DeadlineAt;
  /** Opaque per-user tag sent as `user_id`; never the username. */
  userTag: string;
}

export interface BaselineItemInput {
  index: number;
  originalName: string;
  englishLabel: string;
  quantity: number | null;
  unit: string | null;
  preparationNote: string | null;
  category: string;
}

export interface EstimateBaselineInput {
  items: BaselineItemInput[];
  deadlineAt: DeadlineAt;
  userTag: string;
}

export interface MealPlanContext {
  slots: Array<{
    originalName: string;
    englishLabel: string;
    options: Array<{
      label: string | null;
      items: Array<{ originalName: string; englishLabel: string }>;
    }>;
  }>;
}

/** One reviewed item as the user has it, sent back in REFINE mode (product spec § 7 "AI review"). */
export interface MealRefineItem {
  key: string;
  originalName: string;
  englishLabel: string;
  quantity: number | null;
  unit: string | null;
  quantityUnknown: boolean;
  preparation: string | null;
  category: string;
  /** The answered question text for this item, or null. */
  answer: string | null;
}

export interface MealRefineContext {
  items: MealRefineItem[];
  answers: Array<{ question: string; answer: string }>;
}

export interface AnalyzeMealInput {
  text: string | null;
  /** JPEG bytes, sent base64-inline; empty for text-only. */
  images: Buffer[];
  planContext: MealPlanContext | null;
  /** Set for a REFINE call: the model returns these items, filled in, instead of a fresh list. */
  refine?: MealRefineContext | null;
  deadlineAt: DeadlineAt;
  userTag: string;
}

export interface GenerateReflectionInput {
  facts: ReflectionFact[];
  profile: ProfileContext;
  greetingName: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  /** Recent paragraphs, to reduce repetition. */
  recentParagraphs: string[];
  deadlineAt: DeadlineAt;
  userTag: string;
}
