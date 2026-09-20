import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEP,
  ONBOARDING_TOTAL_STEPS,
  progressPercent,
} from '@/app/(app)/onboarding/plan/plan-screen';

describe('onboarding progress', () => {
  it('counts the review screens as steps and reaches 100 % only on the ready screen', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(10);
    expect(progressPercent(1)).toBeCloseTo(100 / 10);
    expect(progressPercent(ONBOARDING_STEP.ADD_PLAN)).toBeLessThan(
      progressPercent(ONBOARDING_STEP.MEALS),
    );
    expect(progressPercent(ONBOARDING_STEP.NOTES)).toBeLessThan(100);
    expect(progressPercent(ONBOARDING_STEP.READY)).toBe(100);
  });

  it('advances within the meals step, one screen at a time, up to the step itself', () => {
    const first = progressPercent(ONBOARDING_STEP.MEALS, { index: 0, count: 5 });
    const third = progressPercent(ONBOARDING_STEP.MEALS, { index: 2, count: 5 });
    const last = progressPercent(ONBOARDING_STEP.MEALS, { index: 4, count: 5 });
    expect(first).toBeGreaterThan(progressPercent(ONBOARDING_STEP.ADD_PLAN));
    expect(third).toBeGreaterThan(first);
    expect(last).toBe(progressPercent(ONBOARDING_STEP.MEALS));
    expect(last).toBeLessThan(progressPercent(ONBOARDING_STEP.TARGETS));
  });
});
