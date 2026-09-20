import { timeMissing } from '@/components/product/meal/composition';
import { optionRequiredFor } from '@/lib/rubric/match-slot';
import { optionNumber } from '@/lib/rubric/options';
import type { RubricOption, RubricSlot } from '@/lib/rubric/types';
import { type MealDraftState, toRubricItem } from '@/lib/validations/meal';

export interface ReviewGate {
  slot: RubricSlot | null;
  option: RubricOption | null;
  /** 1-based number of the chosen option among its slot's options. */
  optionN: number | null;
  /** The slot's options overlap the items and none is chosen (product spec § 7). */
  optionRequired: boolean;
  backdated: boolean;
  /** No time entered and not declared unknown (B6). */
  timeRequired: boolean;
}

/**
 * What both halves of the review — the scrolling body and the pinned footer
 * — agree on: the linked slot and option, and the two reasons Save is held
 * back. Pure, so the island can render the halves in different slots.
 */
export function reviewGate(input: {
  state: MealDraftState;
  slots: RubricSlot[];
  today: string;
  timeUnknown: boolean;
}): ReviewGate {
  const { state, slots, today, timeUnknown } = input;
  const slot = slots.find((s) => s.id === state.planSlotId) ?? null;
  const option = slot?.options.find((o) => o.id === state.planOptionId) ?? null;
  const optionRequired =
    slot !== null &&
    option === null &&
    optionRequiredFor(state.items.map(toRubricItem), slot, state.kind === 'PLANNED');
  return {
    slot,
    option,
    optionN: slot ? optionNumber(slot, option?.id) : null,
    optionRequired,
    backdated: state.localDate !== today,
    timeRequired: timeMissing(state.time, timeUnknown),
  };
}
