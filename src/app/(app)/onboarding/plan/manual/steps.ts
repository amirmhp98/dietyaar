/**
 * Manual setup progress stored in `PlanDraft.manualStep` so a refresh resumes
 * the wizard where it stopped. `review` hands over to screens 8a–8c.
 */
export const MANUAL_STEPS = [
  'day',
  'slots',
  'items',
  'times',
  'ranges',
  'targets',
  'rules',
  'source',
  'review',
] as const;
export type ManualStep = (typeof MANUAL_STEPS)[number];

export const MANUAL_REVIEW_STEP: ManualStep = 'review';

export function isManualStep(value: string | null): value is ManualStep {
  return value !== null && (MANUAL_STEPS as readonly string[]).includes(value);
}
