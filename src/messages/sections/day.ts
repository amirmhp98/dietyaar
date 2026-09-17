/** Strings owned by the day module. Keys are flat and globally unique; add them here, not in en.ts. */
export const day = {
  // ── Service errors ─────────────────────────────────────────
  'day.errors.futureDate': "That day hasn't happened yet.",

  // ── Day row states (History list, Today header) ────────────
  'day.state.inProgress': 'In progress',
  'day.state.noMeals': 'No meals recorded',
  'day.state.incomplete': 'Incomplete log',
  'day.state.completeByDefault': 'complete by default, {recorded} of {prescribed} meals',
  'day.state.complete': 'Complete',
  'day.coverage': 'Based on {recorded} of {prescribed} prescribed meals',
  'day.coverage.byDefault':
    'Based on {recorded} of {prescribed} prescribed meals · log complete by default',
  'day.recordedMeals.one': '{count} of {prescribed} meals recorded',
  'day.recordedMeals.other': '{count} of {prescribed} meals recorded',

  // ── Rule progress (My plan, History detail) ────────────────
  'day.rule.progress': '{count} of {required} so far',
  'day.rule.met': 'Met · {count} of {required}',
  'day.rule.notMet': 'Not met · {count} of {required}',
  'day.rule.incomplete': 'Not enough complete days to tell',
  'day.rule.flagged': 'Recorded: {names}',
  'day.rule.note': 'Not automatically tracked',
  'day.rule.period.day': 'Today',
  'day.rule.period.week': 'This week',
  'day.rule.planChanged': 'Plan changed during this period · progress against the updated plan',

  // ── Seven-day summary (product spec § 10) ──────────────────
  'history.summary.notEnough': 'A few more complete days will make patterns clearer.',
  'history.summary.slotDifferent':
    '{slot} was a different food or skipped on {days} of {complete} complete days.',
  'history.summary.portionMore':
    '{item} was more than planned on {days} of {complete} complete days.',
  'history.summary.portionLess':
    '{item} was less than planned on {days} of {complete} complete days.',
  'history.summary.order':
    '{slot} was eaten out of the planned order on {days} of {complete} complete days.',
  'history.summary.energyWithin':
    'Within your planned calorie range on {days} of {complete} complete days.',
  'history.summary.energyAbove':
    'Above your planned calorie range on {days} of {complete} complete days.',
  'history.summary.energyBelow':
    'Below your planned calorie range on {days} of {complete} complete days.',
  'history.summary.matchedMost': '{slot} matched your plan on {days} of {complete} complete days.',
  'history.summary.noPattern': 'No repeated difference across {complete} complete days.',
  'history.summary.incompleteDays.one': '{count} day has an incomplete log.',
  'history.summary.incompleteDays.other': '{count} days have incomplete logs.',
  'history.planChanged': 'Your plan changed during these days.',
} as const;
