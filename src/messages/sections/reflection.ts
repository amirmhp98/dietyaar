/** Strings owned by the reflection module. Keys are flat and globally unique; add them here, not in en.ts. */
export const reflection = {
  // ── Card (product spec § 11, § 12) ─────────────────────────
  'reflection.title': "Today's reflection",
  'reflection.staleBadge': 'Based on an earlier log',
  'reflection.update': 'Update reflection',
  'reflection.collapse': 'Collapse',
  'reflection.expand': 'Show reflection',
  'reflection.preparing': 'Preparing your reflection…',
  'reflection.stillPreparing': 'Still preparing your reflection',
  'reflection.retry': 'Retry',
  'reflection.forDate': 'Reflection written the next morning',

  // ── Service errors ─────────────────────────────────────────
  'reflection.errors.dailyCap':
    "You've reached today's limit for reflection updates. Try again tomorrow.",
  'reflection.errors.aiUnavailable': "Reflections can't be updated right now. Try again later.",
  'reflection.errors.notFound': 'There is no reflection for this day yet.',

  // ── Deterministic fallback paragraphs (product spec § 11 states) ──
  // Every sentence is either template glue or the verbatim text of a fact,
  // so a fallback never states something its input snapshot does not contain.
  'reflection.fallback.greeting.morning': 'Good morning, {name}.',
  'reflection.fallback.greeting.afternoon': 'Good afternoon, {name}.',
  'reflection.fallback.greeting.evening': 'Good evening, {name}.',

  'reflection.fallback.firstDay.welcome':
    "Welcome to Dietyaar. There's nothing to look back on yet, and that's fine.",
  'reflection.fallback.firstDay.plan':
    'Log each meal when you eat it and adjust the portions to match what you actually had.',
  'reflection.fallback.firstDay.noPlan':
    "Once you add your plan, each day's meals will be compared with it. Until then you can still log what you eat and keep your totals up to date.",

  'reflection.fallback.noPlan.body':
    "There's no active plan yet, so your meals can't be compared with anything. Add your plan from the Plan tab whenever you're ready; until then you can still log what you eat and keep your totals up to date.",

  'reflection.fallback.noRecords.body':
    "No meals were recorded yesterday, so there's nothing to compare for that day. If you ate and didn't get to log it, you can still add those meals from History at any time.",

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
  'reflection.fallback.close.morning': 'The day is just starting; one meal at a time is enough.',
  'reflection.fallback.close.afternoon':
    "There's still most of the day ahead; one meal at a time is enough.",
  'reflection.fallback.close.evening':
    "There's still time to log the rest of today; one meal at a time is enough.",
} as const;
