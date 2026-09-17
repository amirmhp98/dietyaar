/**
 * Rubric v1 numbers (product spec § 8). Every threshold lives here so a revised
 * rubric is one file and a version bump; comparisons are computed on read, so
 * history follows the new numbers without touching records (decision 013).
 */
export const RUBRIC_VERSION = 'v1';

/** Per prescribed meal, out of 100. */
export const WEIGHT_FOOD = 50;
export const WEIGHT_PORTION = 30;
export const WEIGHT_TIMING = 20;

/** Day score: mean of scored meals × 90 + nutrition component × 10. */
export const WEIGHT_DAY_MEALS = 90;
export const WEIGHT_DAY_NUTRITION = 10;

/** Portion of a matched item, relative to the prescribed amount (inclusive). */
export const PORTION_SMALL = 0.15;
export const PORTION_NOTICEABLE = 0.3;

/** Energy beyond the nearer range boundary, relative to that boundary (inclusive). */
export const ENERGY_SMALL = 0.1;
export const ENERGY_NOTICEABLE = 0.2;

/** Time bands are in lib/time/bands.ts: 60 / 120 minutes, inclusive. */

/** Wording bands for the day score. */
export const BAND_CLOSELY = 85;
export const BAND_MOSTLY = 60;

/** The number is shown only once this many prescribed meals are scored. */
export const MIN_SCORED_FOR_NUMBER = 2;

/** Trend statements need at least this many complete, comparable days. */
export const MIN_COMPLETE_DAYS_FOR_TREND = 3;

/** An added item from these categories turns Matched into Partly matched (product spec § 6, § 8). */
export const CALORIE_SIGNIFICANT = [
  'OIL',
  'BREAD',
  'RICE',
  'POTATO',
  'NUTS',
  'DAIRY',
  'MEAT',
] as const;

/** Listed without a quantity, these never count toward matching and never break a match. */
export const NEVER_COUNTED = ['VEGETABLE', 'HERB', 'CONDIMENT'] as const;
