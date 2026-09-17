import {
  BAND_CLOSELY,
  BAND_MOSTLY,
  MIN_SCORED_FOR_NUMBER,
  WEIGHT_DAY_MEALS,
  WEIGHT_DAY_NUTRITION,
  WEIGHT_FOOD,
  WEIGHT_PORTION,
  WEIGHT_TIMING,
} from '@/lib/rubric/constants';
import { bandValue } from '@/lib/rubric/portion';
import type {
  Coverage,
  DayScore,
  MatchResult,
  PortionResult,
  SlotScore,
  TimingResult,
  WordingBand,
} from '@/lib/rubric/types';

export function foodValue(match: MatchResult): number {
  return match.status === 'MATCHED' ? 1 : match.status === 'PARTLY_MATCHED' ? 0.5 : 0;
}

/**
 * Per prescribed meal: food 50, portion 30, order/timing 20. A component that
 * cannot be evaluated is left out and the score is normalised over the rest.
 */
export function scoreSlot(
  match: MatchResult,
  portion: PortionResult | null,
  timing: TimingResult | null,
): SlotScore {
  const food = foodValue(match);
  const portionValue = portion && portion.mean !== null ? portion.mean : null;
  const timingValue = timing && timing.band !== null ? bandValue(timing.band) : null;

  let weights = WEIGHT_FOOD;
  let sum = food * WEIGHT_FOOD;
  const excluded: SlotScore['excluded'] = [];
  if (portionValue !== null) {
    weights += WEIGHT_PORTION;
    sum += portionValue * WEIGHT_PORTION;
  } else excluded.push('PORTION');
  if (timingValue !== null) {
    weights += WEIGHT_TIMING;
    sum += timingValue * WEIGHT_TIMING;
  } else excluded.push('TIMING');

  return {
    score: Math.round((sum / weights) * 100),
    food,
    portion: portionValue,
    timing: timingValue,
    weightsUsed: weights,
    excluded,
  };
}

export function wordingBand(score: number | null, scored: number): WordingBand {
  if (score === null || scored === 0) return 'NOT_ENOUGH';
  if (score >= BAND_CLOSELY) return 'CLOSELY';
  if (score >= BAND_MOSTLY) return 'MOSTLY';
  return 'DIFFERENT';
}

/**
 * Day score: mean of scored prescribed meals × 90 + nutrition × 10, normalised
 * over the meal component alone when nutrition is left out. Skipped meals
 * count in coverage, never in the score. The number needs two scored meals.
 */
export function scoreDay(
  slotScores: number[],
  nutritionComponent: number | null,
  coverage: Coverage,
  completeByDefault: boolean,
): DayScore {
  const scored = slotScores.length;
  const mealMean = scored === 0 ? null : slotScores.reduce((a, b) => a + b, 0) / scored;
  let dayScore: number | null = null;
  if (mealMean !== null) {
    dayScore =
      nutritionComponent === null
        ? Math.round(mealMean)
        : Math.round(
            (mealMean * WEIGHT_DAY_MEALS + nutritionComponent * 100 * WEIGHT_DAY_NUTRITION) /
              (WEIGHT_DAY_MEALS + WEIGHT_DAY_NUTRITION),
          );
  }
  return {
    dayScore,
    showNumber: scored >= MIN_SCORED_FOR_NUMBER && dayScore !== null,
    band: wordingBand(dayScore, scored),
    coverage,
    completeByDefault,
    nutritionComponent,
    mealMean: mealMean === null ? null : Math.round(mealMean * 10) / 10,
  };
}
