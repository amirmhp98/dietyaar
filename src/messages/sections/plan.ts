/** Strings owned by the plan module. Keys are flat and globally unique; add them here, not in en.ts. */
export const plan = {
  'plan.errors.textTooLong': 'Your plan is longer than 20,000 characters. Paste it in parts.',
  'plan.errors.noPlan': 'You have no plan yet.',
  'plan.errors.noDraft': 'There is no plan draft to work on. Start again from Add your plan.',
  'plan.errors.confirmationMismatch': 'Type the plan name exactly to confirm.',
  'plan.errors.dailyCap': "You've reached today's limit for plan imports. Try again tomorrow.",
  'plan.errors.aiUnavailable':
    "We couldn't estimate the nutrition right now. You can enter values yourself or try again.",
  'plan.errors.aiTimeout': 'Estimating took too long. Try again, or enter the values yourself.',
  'validation.timeInvalid': 'Enter a time as HH:MM',
  'validation.targetRange': 'A range needs a lower and an upper value, in that order',
  'validation.targetValue': 'Enter a value for this target',
  'validation.ruleDefinition': 'This rule is missing the details needed to track it',
} as const;
