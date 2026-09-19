import type { DraftFoodItem } from '@/lib/validations/meal';

/**
 * Pure pieces of the composer's state logic, kept out of the island so they
 * can be unit-tested: new items, the manual seed (B7), the time gate (B6)
 * and the default slot link after an analysis (B4).
 */

export const OTHER_SLOT = 'OTHER';

let newItemSeq = 0;
export function newDraftItem(position: number): DraftFoodItem {
  newItemSeq += 1;
  return {
    key: `new-${Date.now().toString(36)}-${newItemSeq}`,
    position,
    originalName: '',
    englishLabel: '',
    quantity: null,
    unit: null,
    quantityUnknown: false,
    quantityAssumed: false,
    preparation: null,
    category: 'OTHER',
    alternatives: [],
    chosenAlternative: null,
    nutrition: null,
    matchedPlanItemId: null,
    isAddedItem: false,
    needsReestimate: false,
    previousNutrition: null,
    scaleFlag: null,
    ruleGroups: [],
  };
}

const MANUAL_SEED_MAX = 120;

/** "Enter manually" keeps what was typed as the first item's name (O D13); an empty box seeds nothing. */
export function seedManualItem(text: string): DraftFoodItem | null {
  const name = text.trim().slice(0, MANUAL_SEED_MAX).trim();
  if (name === '') return null;
  return { ...newDraftItem(0), originalName: name, englishLabel: name, quantityUnknown: true };
}

/**
 * Save is blocked while the time is neither entered nor declared unknown
 * (F 1.2-1): unticking "I don't remember the time" leaves the field empty,
 * never a made-up noon.
 */
export function timeMissing(time: string | null, timeUnknown: boolean): boolean {
  return !timeUnknown && (time === null || time === '');
}

/**
 * Where a freshly analysed meal lands (O D5, O D12 owner decision 12): the
 * user's own choice always wins; otherwise the AI's suggested slot, unless
 * there is none or that slot already holds a meal today — then it is an
 * extra meal (Other), and `extraSlotId` names the taken slot so the review
 * can say why.
 */
export function defaultLinkAfterAnalysis(input: {
  /** null = not chosen, OTHER_SLOT, or a plan slot id. */
  userChoice: string | null;
  suggestedSlotId: string | null;
  recordedSlotIds: readonly string[];
}): { slotChoice: string | null; extraSlotId: string | null } {
  if (input.userChoice !== null) return { slotChoice: input.userChoice, extraSlotId: null };
  if (input.suggestedSlotId === null) return { slotChoice: OTHER_SLOT, extraSlotId: null };
  if (input.recordedSlotIds.includes(input.suggestedSlotId)) {
    return { slotChoice: OTHER_SLOT, extraSlotId: input.suggestedSlotId };
  }
  return { slotChoice: input.suggestedSlotId, extraSlotId: null };
}
