/** Strings owned by the reflection module. Keys are flat and globally unique; add them here, not in en.ts. */
export const reflection = {
  // ── Card (product spec § 11, § 12) ─────────────────────────
  'reflection.title': "Today's reflection",
  'reflection.staleBadge': 'Based on an earlier log',
  'reflection.update': 'Update reflection',
  'reflection.gotIt': 'Got it',
  'reflection.collapse': 'Collapse',
  'reflection.readAgain': 'Read again',
  'reflection.preparing': 'Preparing your reflection…',
  'reflection.stillPreparing': 'Still preparing your reflection',
  'reflection.retry': 'Retry',
  'reflection.forDate': 'Reflection written the next morning',

  // ── Service errors ─────────────────────────────────────────
  'reflection.errors.dailyCap':
    "You've reached today's limit for reflection updates. Try again tomorrow.",
  'reflection.errors.aiUnavailable': "Reflections can't be updated right now. Try again later.",
  'reflection.errors.notFound': 'There is no reflection for this day yet.',

  // ── Deterministic paragraphs (product spec § 11 states) ──
  // Every sentence is either template glue or the verbatim text of a fact,
  // so a paragraph never states something its input snapshot does not contain.
  // The static states (first day, no records yesterday, no plan) are written
  // without an AI call and read exactly as below plus the greeting and close.
  'reflection.fallback.greeting.morning': 'Good morning, {name}.',
  'reflection.fallback.greeting.afternoon': 'Good afternoon, {name}.',
  'reflection.fallback.greeting.evening': 'Good evening, {name}.',

  'reflection.fallback.firstDay.welcome':
    "Welcome — there's nothing to look back on yet, and today is day one.",
  'reflection.fallback.firstDay.startsWith':
    'Your plan starts with {slot}; when you eat it, log it and adjust the portions to what you actually had.',
  'reflection.fallback.firstDay.next':
    'The next meal in your plan is {slot}; when you eat it, log it and adjust the portions to what you actually had.',
  'reflection.fallback.firstDay.noPlan':
    "Once you add your plan from the Plan tab, each day's meals will be compared with it; until then, everything you log still counts towards your totals.",
  'reflection.fallback.firstDay.tomorrow':
    'From tomorrow on, this card will tell you how the day before went.',

  'reflection.fallback.noPlan.body':
    "Your meals can't be compared with anything yet because there's no plan. Add it from the Plan tab whenever you're ready; until then, everything you log still counts towards your totals.",

  'reflection.fallback.noRecords.intro':
    'Yesterday went by without any meals logged — that happens, and nothing is lost.',
  'reflection.fallback.noRecords.startsWith':
    'Today is a fresh page: your plan starts with {slot}, and logging it takes a few taps.',
  'reflection.fallback.noRecords.next':
    'Today is a fresh page: the next meal in your plan is {slot}, and logging it takes a few taps.',
  'reflection.fallback.noRecords.history':
    "If you'd like to fill in yesterday, History is always open.",

  'reflection.fallback.unchecked.intro':
    "Yesterday's log is marked incomplete, so this reflection covers the meals you recorded rather than your full day.",

  'reflection.fallback.complete.intro': "Here's what yesterday's log shows.",

  'reflection.fallback.providerFailure.body':
    "Your reflection couldn't be prepared just now. Nothing about your log or plan is affected: everything you recorded is still there and today's comparison keeps working as usual. You can ask for an update from this card later.",

  'reflection.fallback.today.startsWith': "Today's plan starts with {slot}.",
  'reflection.fallback.today.next': 'The next meal in your plan is {slot}.',
  'reflection.fallback.today.allRecorded': "Every meal in today's plan is already recorded.",

  'reflection.fallback.anythingToAdd':
    "If there's anything to add to yesterday, you can do that at any time.",
  'reflection.fallback.close.morning': 'One meal at a time is plenty.',
  'reflection.fallback.close.afternoon':
    "There's still most of the day ahead — one meal at a time is plenty.",
  'reflection.fallback.close.evening':
    "There's still time to log the rest of today — one meal at a time is plenty.",

  // ── Card island (task 8.2) ─────────────────────────────────
  'reflection.updating': 'Updating…',
  'reflection.updated': 'Reflection updated',
  'reflection.stillPreparingBody':
    "This is taking longer than usual. Your log and today's comparison keep working as usual.",
} as const;
