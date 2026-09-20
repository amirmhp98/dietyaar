import type { Band } from '@/lib/time/bands';
import type { Nutrition, NutrientKey } from '@/lib/validations/nutrition';

/**
 * Plain-object inputs and outputs of the rubric. No Prisma types: the day
 * service converts rows (Decimal → number) at the boundary.
 */

export type FoodCategoryKey =
  | 'OIL'
  | 'BREAD'
  | 'RICE'
  | 'POTATO'
  | 'NUTS'
  | 'DAIRY'
  | 'MEAT'
  | 'VEGETABLE'
  | 'HERB'
  | 'CONDIMENT'
  | 'FRUIT'
  | 'OTHER';

export interface FoodName {
  originalName: string;
  englishLabel: string;
}

export interface RubricAlternative extends FoodName {
  nutrition?: Nutrition | null;
}

/** A prescribed item inside one option of a slot. */
export interface RubricPlanItem extends FoodName {
  id: string;
  quantity: number | null;
  unit: string | null;
  quantityAssumed: boolean;
  category: FoodCategoryKey;
  alternatives: RubricAlternative[];
  nutrition: Nutrition | null;
}

export interface RubricOption {
  id: string;
  position: number;
  label: string | null;
  items: RubricPlanItem[];
}

export interface RubricSlot extends FoodName {
  id: string;
  weekday: number;
  position: number;
  /** "HH:mm" or null when the plan gives no time. */
  timeStart: string | null;
  timeEnd: string | null;
  options: RubricOption[];
}

/** A confirmed food item of a recorded meal. */
export interface RubricFoodItem extends FoodName {
  id: string;
  quantity: number | null;
  unit: string | null;
  quantityUnknown: boolean;
  category: FoodCategoryKey;
  alternatives: RubricAlternative[];
  /** The plan item this recorded item was matched to, when known. */
  matchedPlanItemId: string | null;
  isAddedItem: boolean;
  nutrition: Nutrition | null;
}

export interface RubricMeal {
  id: string;
  revision: number;
  planSlotId: string | null;
  planOptionId: string | null;
  /** "HH:mm" in the day's zone; null = time unknown. */
  consumedLocalTime: string | null;
  items: RubricFoodItem[];
}

export type TargetTypeKey = 'RANGE' | 'MINIMUM' | 'MAXIMUM' | 'DESIRED' | 'APPROXIMATE';
export type TargetSourceKey = 'EXPLICIT' | 'ESTIMATED' | 'SUM_OF_MEALS';

export interface RubricTarget {
  /** Null = daily target. */
  planSlotId: string | null;
  nutrient: NutrientKey;
  type: TargetTypeKey;
  low: number | null;
  high: number | null;
  source: TargetSourceKey;
}

export type DayPhase = 'ONGOING' | 'PAST';
export type PlanStructureKey = 'SAME_EVERY_DAY' | 'BY_WEEKDAY' | 'TARGETS_ONLY';

export interface DayInput {
  localDate: string;
  zone: string;
  dayPhase: DayPhase;
  logComplete: boolean;
  /** True when a DayRecord row exists (a meal, skip or completeness change happened). */
  hasRecord: boolean;
  planStructure: PlanStructureKey | null;
  /** The plan's slots for this weekday, in plan order. */
  slots: RubricSlot[];
  /** Every slot of the plan (for cross-slot detection), any weekday. */
  allSlots: RubricSlot[];
  meals: RubricMeal[];
  skippedSlotIds: string[];
  targets: RubricTarget[];
}

// ─── Results ──────────────────────────────────────────────────────────────

export type MatchStatus = 'MATCHED' | 'PARTLY_MATCHED' | 'DIFFERENT_FOOD';
export type MatchReason = 'MISSING' | 'MIXED' | 'CROSS_SLOT' | 'ADDED' | null;

export interface MatchResult {
  status: MatchStatus;
  reason: MatchReason;
  /** Counted plan items of the option that were not recorded. */
  missing: RubricPlanItem[];
  /** Calorie-significant recorded items outside the option. */
  added: RubricFoodItem[];
  /** Recorded items that belong to another option of the same slot. */
  mixed: boolean;
  /** When CROSS_SLOT: the slot whose option was eaten. */
  crossSlot: FoodName | null;
  /** Pairs of (recorded item, matched plan item). */
  matched: Array<{ item: RubricFoodItem; planItem: RubricPlanItem }>;
  /** Counted plan items of the option. */
  countedTotal: number;
  presentCount: number;
}

export interface PortionItemResult {
  item: RubricFoodItem;
  planItem: RubricPlanItem;
  /** Actual and planned amounts in the plan item's unit. */
  actual: number;
  planned: number;
  unit: string;
  /** Signed ratio (actual − planned) / planned. */
  ratio: number;
  band: Band;
}

export interface PortionResult {
  items: PortionItemResult[];
  /** Mean of per-item values (SMALL 1, NOTICEABLE 0.5, LARGE 0), or null when nothing is evaluable. */
  mean: number | null;
  /** Counted matched items whose portion could not be evaluated (unknown quantity or unit). */
  notEvaluated: RubricFoodItem[];
}

export type EnergyStatus = 'WITHIN' | 'BELOW' | 'ABOVE';

export interface EnergyResult {
  status: EnergyStatus;
  band: Band;
  /** Signed kcal difference from the nearer boundary (0 when within). */
  difference: number;
  target: RubricTarget;
}

export type TimingKind = 'TIME' | 'ORDER' | 'NONE';

export interface TimingResult {
  kind: TimingKind;
  /** Null when not evaluated (unknown time, or a single recorded meal for the order rule). */
  band: Band | null;
  /** TIME: signed minutes outside the window (negative = before). ORDER: unused. */
  minutes: number | null;
  /** ORDER: the slot this one was eaten before/after out of sequence. */
  outOfOrderWith: { slot: FoodName; direction: 'BEFORE' | 'AFTER' } | null;
  /** Why the component was left out. */
  notEvaluatedReason: 'TIME_UNKNOWN' | 'NO_ORDER_REFERENCE' | null;
}

export type SlotState = 'NOT_RECORDED' | 'RECORDED' | 'SKIPPED' | 'NEEDS_REVIEW';

export interface SlotScore {
  score: number | null;
  food: number | null;
  portion: number | null;
  timing: number | null;
  weightsUsed: number;
  excluded: Array<'FOOD' | 'PORTION' | 'TIMING'>;
}

export interface SlotView {
  slot: RubricSlot;
  state: SlotState;
  /** Linked meal ids, earliest consumed first. */
  mealIds: string[];
  /** The resolved option (all linked meals agree), or null. */
  option: RubricOption | null;
  /** Options named by linked meals when they disagree (NEEDS_REVIEW). */
  conflictingOptionIds: string[];
  earliestTime: string | null;
  match: MatchResult | null;
  portion: PortionResult | null;
  timing: TimingResult | null;
  /** The meal's energy against this slot's own range, details only. */
  slotEnergy: EnergyResult | null;
  recordedEnergyKcal: number | null;
  score: SlotScore | null;
  /** The slot's own energy range for the row label. */
  energyTarget: RubricTarget | null;
}

export type WordingBand = 'CLOSELY' | 'MOSTLY' | 'DIFFERENT' | 'NOT_ENOUGH';

export interface Coverage {
  prescribed: number;
  recorded: number;
  scored: number;
  skipped: number;
  needsReview: number;
  notRecorded: number;
}

export interface DayScore {
  dayScore: number | null;
  showNumber: boolean;
  band: WordingBand;
  coverage: Coverage;
  /** Past day, checked, but some slot not recorded or skipped. */
  completeByDefault: boolean;
  /** 1 / 0.5 / 0 / null when left out. */
  nutritionComponent: number | null;
  mealMean: number | null;
}

export interface NutrientSubtotal {
  nutrient: NutrientKey;
  value: number | null;
  /** False when any included item has no usable value. */
  complete: boolean;
  /** Recorded items without a value for this nutrient. */
  missingItems: number;
}

export type TargetComparisonStatus =
  | 'BELOW_RANGE'
  | 'WITHIN_RANGE'
  | 'ABOVE_RANGE'
  | 'BELOW_TARGET'
  | 'TARGET_MET'
  | 'WITHIN_LIMIT'
  | 'ABOVE_LIMIT'
  | 'SIGNED_DIFFERENCE'
  /** Ongoing day or incomplete log: recorded amount and target only. */
  | 'PROGRESS'
  /** Subtotal incomplete: no definitive status. */
  | 'INCOMPLETE'
  | 'NO_TARGET';

export interface TargetComparison {
  nutrient: NutrientKey;
  subtotal: NutrientSubtotal;
  target: RubricTarget | null;
  status: TargetComparisonStatus;
  /** Signed difference for DESIRED / APPROXIMATE, or from the nearer boundary. */
  difference: number | null;
}

export interface DayView {
  rubricVersion: string;
  localDate: string;
  zone: string;
  dayPhase: DayPhase;
  logComplete: boolean;
  hasRecord: boolean;
  planStructure: PlanStructureKey | null;
  slots: SlotView[];
  /** Meals saved under "Other". */
  otherMealIds: string[];
  mealCount: number;
  contributing: Array<{ mealId: string; revision: number }>;
  score: DayScore;
  nutrition: TargetComparison[];
  dailyEnergy: EnergyResult | null;
  /** Complete for trend purposes: past, checked, at least one meal, every slot recorded or skipped. */
  trendEligible: boolean;
  /** Timeline of the day's recorded prescribed slots (for order details). */
  timeline: Array<{ slotId: string; time: string }>;
}
