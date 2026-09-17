import { CALORIE_SIGNIFICANT, NEVER_COUNTED } from '@/lib/rubric/constants';
import { sameFood } from '@/lib/rubric/names';
import type {
  MatchResult,
  RubricFoodItem,
  RubricOption,
  RubricPlanItem,
  RubricSlot,
} from '@/lib/rubric/types';

/** Raw vegetables and herbs listed without a quantity never count toward matching. */
export function isCounted(item: RubricPlanItem): boolean {
  return !((NEVER_COUNTED as readonly string[]).includes(item.category) && item.quantity === null);
}

export function isCalorieSignificant(item: { category: string }): boolean {
  return (CALORIE_SIGNIFICANT as readonly string[]).includes(item.category);
}

function findPlanItem(item: RubricFoodItem, option: RubricOption): RubricPlanItem | undefined {
  if (item.matchedPlanItemId) {
    const byId = option.items.find((p) => p.id === item.matchedPlanItemId);
    if (byId) return byId;
  }
  return option.items.find((p) => sameFood(item, p));
}

function optionPresence(items: RubricFoodItem[], option: RubricOption) {
  const counted = option.items.filter(isCounted);
  const matched: MatchResult['matched'] = [];
  const presentIds = new Set<string>();
  for (const item of items) {
    const planItem = findPlanItem(item, option);
    if (planItem) {
      matched.push({ item, planItem });
      presentIds.add(planItem.id);
    }
  }
  const missing = counted.filter((p) => !presentIds.has(p.id));
  return { counted, matched, presentIds, missing };
}

/**
 * Compare the combined recorded items of a slot with its chosen option
 * (product spec § 8 "Matching a recorded meal to a plan with options").
 */
export function matchSlot(
  items: RubricFoodItem[],
  option: RubricOption,
  slot: RubricSlot,
  allSlots: RubricSlot[],
): MatchResult {
  const { counted, matched, presentIds, missing } = optionPresence(items, option);
  const matchedItemIds = new Set(matched.map((m) => m.item.id));
  const unmatched = items.filter((i) => !matchedItemIds.has(i.id));

  // Items from another option of the same slot → mixed.
  const otherOptions = slot.options.filter((o) => o.id !== option.id);
  const mixed = unmatched.some((i) =>
    otherOptions.some((o) => o.items.some((p) => sameFood(i, p))),
  );

  // A full option from another slot of the plan → cross-slot (no credit to the other slot).
  let crossSlot: MatchResult['crossSlot'] = null;
  for (const other of allSlots) {
    if (other.id === slot.id) continue;
    for (const o of other.options) {
      const oc = o.items.filter(isCounted);
      if (oc.length === 0) continue;
      const allPresent = oc.every((p) => items.some((i) => sameFood(i, p)));
      if (allPresent) {
        crossSlot = { originalName: other.originalName, englishLabel: other.englishLabel };
        break;
      }
    }
    if (crossSlot) break;
  }

  // Added calorie-significant items outside the option (an added amount of a prescribed food is a portion difference, not an added item).
  const added = unmatched.filter(
    (i) => isCalorieSignificant(i) && !option.items.some((p) => sameFood(i, p)),
  );

  const countedTotal = counted.length;
  const presentCount = counted.filter((p) => presentIds.has(p.id)).length;
  const half = countedTotal === 0 ? true : presentCount * 2 >= countedTotal;
  const allPresent = missing.length === 0;

  let status: MatchResult['status'];
  let reason: MatchResult['reason'] = null;

  if (allPresent && added.length === 0 && !mixed) {
    status = 'MATCHED';
  } else if (allPresent && added.length > 0) {
    status = 'PARTLY_MATCHED';
    reason = 'ADDED';
  } else if (crossSlot && !half) {
    status = 'PARTLY_MATCHED';
    reason = 'CROSS_SLOT';
  } else if (mixed && half) {
    status = 'PARTLY_MATCHED';
    reason = 'MIXED';
  } else if (half && countedTotal > 0) {
    status = 'PARTLY_MATCHED';
    reason = missing.length > 0 ? 'MISSING' : added.length > 0 ? 'ADDED' : mixed ? 'MIXED' : null;
  } else if (mixed && presentCount > 0) {
    status = 'PARTLY_MATCHED';
    reason = 'MIXED';
  } else {
    status = 'DIFFERENT_FOOD';
    reason = crossSlot ? 'CROSS_SLOT' : null;
    if (crossSlot) status = 'PARTLY_MATCHED';
  }

  return { status, reason, missing, added, mixed, crossSlot, matched, countedTotal, presentCount };
}

/** The option of a slot with the highest counted-item overlap (AI/user suggestion helper). */
export function bestOption(items: RubricFoodItem[], slot: RubricSlot): RubricOption | null {
  let best: { option: RubricOption; score: number } | null = null;
  for (const option of slot.options) {
    const { counted, presentIds } = optionPresence(items, option);
    const present = counted.filter((p) => presentIds.has(p.id)).length;
    const score = counted.length === 0 ? 0 : present / counted.length;
    if (!best || score > best.score) best = { option, score };
  }
  return best?.option ?? null;
}
