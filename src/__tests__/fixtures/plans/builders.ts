import type {
  FoodCategoryKey,
  RubricFoodItem,
  RubricMeal,
  RubricOption,
  RubricPlanItem,
  RubricSlot,
  RubricTarget,
  DayInput,
} from '@/lib/rubric/types';
import type { Nutrition } from '@/lib/validations/nutrition';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

/** Reset ids so fixtures are stable between test files. */
export function resetIds() {
  seq = 0;
}

export function nutrition(
  kcal: number | null,
  protein: number | null = null,
  carb: number | null = null,
  fat: number | null = null,
  overrides: Partial<Nutrition> = {},
): Nutrition {
  return {
    basis: 'PER_RECORDED_PORTION',
    basisQuantity: null,
    basisUnit: null,
    values: {
      ENERGY_KCAL: kcal,
      PROTEIN_G: protein,
      CARB_G: carb,
      FAT_G: fat,
      FIBER_G: null,
      SODIUM_MG: null,
    },
    source: 'AI_ESTIMATE',
    sourceRef: null,
    isEstimate: true,
    userOverride: false,
    ...overrides,
  };
}

/** Plan item: `pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210)`. */
export function pi(
  originalName: string,
  englishLabel: string,
  quantity: number | null,
  unit: string | null,
  category: FoodCategoryKey,
  kcal: number | null = null,
  extra: Partial<RubricPlanItem> = {},
): RubricPlanItem {
  return {
    id: nextId('pi'),
    originalName,
    englishLabel,
    quantity,
    unit,
    quantityAssumed: false,
    category,
    alternatives: [],
    nutrition: kcal === null ? null : nutrition(kcal),
    ...extra,
  };
}

export function option(
  items: RubricPlanItem[],
  label: string | null = null,
  position = 0,
): RubricOption {
  return { id: nextId('opt'), position, label, items };
}

export function slot(
  originalName: string,
  englishLabel: string,
  options: RubricOption[],
  position: number,
  extra: Partial<RubricSlot> = {},
): RubricSlot {
  options.forEach((o, i) => (o.position = i));
  return {
    id: nextId('slot'),
    weekday: 7,
    position,
    originalName,
    englishLabel,
    timeStart: null,
    timeEnd: null,
    options,
    ...extra,
  };
}

/** Recorded food item. Matched by name unless `matchedPlanItemId` is given. */
export function fi(
  originalName: string,
  englishLabel: string,
  quantity: number | null,
  unit: string | null,
  category: FoodCategoryKey,
  kcal: number | null = null,
  extra: Partial<RubricFoodItem> = {},
): RubricFoodItem {
  return {
    id: nextId('fi'),
    originalName,
    englishLabel,
    quantity,
    unit,
    quantityUnknown: quantity === null,
    category,
    alternatives: [],
    matchedPlanItemId: null,
    isAddedItem: false,
    nutrition: kcal === null ? null : nutrition(kcal),
    ruleGroups: [],
    ...extra,
  };
}

/** A recorded item copied from a plan item with the prescribed amount (or an override). */
export function eaten(
  planItem: RubricPlanItem,
  quantity = planItem.quantity,
  kcal?: number | null,
): RubricFoodItem {
  const value = kcal === undefined ? (planItem.nutrition?.values.ENERGY_KCAL ?? null) : kcal;
  return fi(
    planItem.originalName,
    planItem.englishLabel,
    quantity,
    planItem.unit,
    planItem.category,
    value,
    {
      matchedPlanItemId: planItem.id,
      quantityUnknown: false,
    },
  );
}

export function meal(
  planSlotId: string | null,
  planOptionId: string | null,
  time: string | null,
  items: RubricFoodItem[],
  extra: Partial<RubricMeal> = {},
): RubricMeal {
  return {
    id: nextId('meal'),
    revision: 1,
    planSlotId,
    planOptionId,
    consumedLocalTime: time,
    items,
    ...extra,
  };
}

export function range(
  low: number,
  high: number,
  planSlotId: string | null = null,
  source: RubricTarget['source'] = 'EXPLICIT',
): RubricTarget {
  return { planSlotId, nutrient: 'ENERGY_KCAL', type: 'RANGE', low, high, source };
}

export function dayInput(slots: RubricSlot[], overrides: Partial<DayInput> = {}): DayInput {
  return {
    localDate: '2026-09-16',
    zone: 'Asia/Dubai',
    dayPhase: 'PAST',
    logComplete: true,
    hasRecord: true,
    planStructure: 'SAME_EVERY_DAY',
    slots,
    allSlots: slots,
    meals: [],
    skippedSlotIds: [],
    targets: [],
    rules: [],
    ...overrides,
  };
}
