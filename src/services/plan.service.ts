import type { RubricRule, RubricSlot, RubricTarget } from '@/lib/rubric/types';

/**
 * STUB — replaced by the plan agent (task 4.2). Only the read contract other
 * modules compile against is declared here.
 */
export interface ActivePlan {
  id: string;
  status: 'NONE' | 'DRAFT_PENDING' | 'ACTIVE';
  structure: 'SAME_EVERY_DAY' | 'BY_WEEKDAY' | 'TARGETS_ONLY' | null;
  name: string | null;
  sourceNote: string | null;
  confirmedAt: Date | null;
  /** Every slot of the plan, any weekday, with options and items (numbers, not Decimals). */
  slots: RubricSlot[];
  targets: Array<RubricTarget & { id: string; weekday: number | null }>;
  rules: Array<
    RubricRule & { sourceExcerpt: string; isConflicting: boolean; unsupportedReason: string | null }
  >;
  notes: Array<{ id: string; originalText: string; reason: string }>;
  /** Pending draft, if any. */
  draft: { kind: 'IMPORT' | 'MANUAL' | 'EDIT'; state: 'PENDING' | 'READY' | 'FAILED' } | null;
}

/** The active plan (rows), or null when `status = NONE` and no rows exist. */
export async function getActivePlan(_ownerId: string): Promise<ActivePlan | null> {
  return null;
}

/** Slots that apply on a weekday (0–6): same-every-day slots (7) or that weekday's, in plan order. */
export function slotsForWeekday(plan: Pick<ActivePlan, 'slots'>, weekday: number): RubricSlot[] {
  return plan.slots
    .filter((s) => s.weekday === 7 || s.weekday === weekday)
    .sort((a, b) => a.position - b.position);
}
