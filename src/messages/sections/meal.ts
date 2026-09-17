/** Strings owned by the meal module. Keys are flat and globally unique; add them here, not in en.ts. */
export const meal = {
  'meal.errors.textTooLong': 'Keep the description under 2,000 characters.',

  // ── Product spec § 12 copy rows ────────────────────────────
  'meal.saved': 'Meal saved',
  'meal.errors.saveFailed': "Your meal hasn't saved yet. Your edits are still here. Try again.",
  'meal.errors.conflict':
    'This meal was updated on another device. Reload to see the latest version.',
  'meal.errors.analysisFailed':
    "We couldn't estimate this meal. Try again or enter the details yourself.",
  'meal.errors.aiTimeout':
    "We couldn't estimate this meal. Try again or enter the details yourself.",
  'meal.errors.aiUnavailable': 'Estimates are unavailable right now. Enter the details yourself.',
  'meal.errors.aiCap': "You've reached today's limit for AI estimates. Enter the details yourself.",

  // ── Service error codes (tech spec § 7) ────────────────────
  'meal.errors.optionRequired': 'Choose the option you ate before saving.',
  'meal.errors.futureTime': "This time hasn't happened yet. Adjust the time to save the meal.",
  'meal.errors.slotHasMeal':
    'A meal is already recorded for this slot. Remove it to mark the slot skipped.',
  'meal.errors.slotNotOnDay': "This plan slot doesn't apply on that day.",
  'meal.errors.optionNotInSlot': "That option doesn't belong to the chosen slot.",
  'meal.errors.nothingToAnalyze': 'Describe the meal or add a photo first.',
  'meal.errors.draftNotFound': 'This draft has expired. Start the meal again.',
  'meal.errors.mealNotFound': 'This meal no longer exists.',
  'meal.errors.uploadNotFound': 'This photo no longer exists.',
} as const;
