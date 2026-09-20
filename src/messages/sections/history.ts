/** Strings owned by History (design-scope screen 7, product spec § 10). Keys are flat and globally unique; add them here, not in en.ts. */
export const history = {
  // ── Seven-day view ─────────────────────────────────────────
  'history.title': 'History',
  'history.subtitle': 'The past seven days',
  'history.pickDate': 'Choose an older day',
  'history.today': 'Today',
  'history.yesterday': 'Yesterday',
  'history.startsOn': 'Your history starts on {date}',
  'history.openDay': 'Open {date}',

  // ── Pattern summary (product spec § 10) ────────────────────
  'history.summary.notEnough': 'A few more complete days will make patterns clearer.',
  'history.summary.slotDifferentFood':
    '{slot} was a different food on {days} of {complete} complete days.',
  'history.summary.slotSkipped': '{slot} was skipped on {days} of {complete} complete days.',
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
  'history.summary.completeDays.one': '{count} complete day',
  'history.summary.completeDays.other': '{count} complete days',
  'history.summary.incompleteDays.one': '{count} day with an incomplete log',
  'history.summary.incompleteDays.other': '{count} days with incomplete logs',
  'history.planChanged': 'Your plan changed during these days.',

  // ── Day rows ───────────────────────────────────────────────
  'day.state.inProgress': 'In progress',
  'day.state.noMeals': 'No meals recorded',
  'day.state.incomplete': 'Incomplete log',
  'day.state.completeByDefault': 'Marked complete · {recorded} of {prescribed} meals recorded',
  'day.state.complete': 'Complete',
  'history.row.meals.one': '{count} meal recorded',
  'history.row.meals.other': '{count} meals recorded',
  'history.row.coverage': '{scored} of {total} meals',

  // ── One day ────────────────────────────────────────────────
  'history.day.backToHistory': 'Back to History',
  'history.day.logMeal': 'Add a meal to this day',
  'history.day.notFoundTitle': 'No such day',
} as const;
