import { RUBRIC_VERSION } from '@/lib/rubric/constants';
import { energyResult } from '@/lib/rubric/energy';
import { matchSlot, optionRequiredFor } from '@/lib/rubric/match-slot';
import {
  compareTarget,
  dailyTargetFor,
  nutritionComponent,
  nutritionSubtotals,
} from '@/lib/rubric/nutrition';
import { portionResult } from '@/lib/rubric/portion';
import { scoreDay, scoreSlot } from '@/lib/rubric/score';
import { orderResult, statedWindow, timeResult, type OrderEntry } from '@/lib/rubric/timing';
import type {
  Coverage,
  DayInput,
  DayView,
  RubricMeal,
  RubricOption,
  RubricSlot,
  SlotState,
  SlotView,
} from '@/lib/rubric/types';
import {
  assignWindows,
  DAY_END,
  DAY_START,
  windowOf,
  windowStateAt,
  type SlotWindow,
  type WindowState,
} from '@/lib/rubric/windows';
import { minutesBetween } from '@/lib/time/bands';

function earliestTime(meals: RubricMeal[]): string | null {
  const times = meals.map((m) => m.consumedLocalTime).filter((t): t is string => t !== null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (minutesBetween(a, b) > 0 ? a : b));
}

/** After `assignWindows` every slot has one; the whole-day fallback is never reached. */
function windowFor(slot: RubricSlot): SlotWindow {
  return windowOf(slot) ?? { start: DAY_START, end: DAY_END, assumed: true };
}

/** Past day: every window has passed; future day: none has opened; today: the clock decides. */
function windowStateFor(input: DayInput, window: SlotWindow): WindowState {
  if (input.dayPhase === 'PAST') return 'PASSED';
  if (input.nowLocalTime === null) return 'UPCOMING';
  return windowStateAt(window, input.nowLocalTime);
}

/**
 * The option a recorded slot is compared with: the resolved one, or, for a
 * meal saved under the slot without an option (a different food), the first
 * option, which the matcher then reports as Different food (product spec § 8).
 */
function referenceOption(view: SlotView): RubricOption | null {
  if (view.option) return view.option;
  const [first] = [...view.slot.options].sort((a, b) => a.position - b.position);
  return first ?? null;
}

/**
 * Tech spec § 6 "Calculation order for one day". Pure and deterministic:
 * identical input → identical view.
 */
export function computeDayView(input: DayInput): DayView {
  const { meals, skippedSlotIds, dayPhase, logComplete } = input;
  // Rows confirmed before windows existed (or seeded directly) get theirs here, so a row always has one.
  const slots = assignWindows(input.slots);
  const skipped = new Set(skippedSlotIds);
  const bySlot = new Map<string, RubricMeal[]>();
  const otherMealIds: string[] = [];
  for (const meal of meals) {
    if (meal.planSlotId === null || !slots.some((s) => s.id === meal.planSlotId)) {
      otherMealIds.push(meal.id);
      continue;
    }
    const list = bySlot.get(meal.planSlotId) ?? [];
    list.push(meal);
    bySlot.set(meal.planSlotId, list);
  }

  // Steps 3–4: slot states.
  const views: SlotView[] = slots.map((slot) => {
    const linked = (bySlot.get(slot.id) ?? []).slice().sort((a, b) => {
      if (a.consumedLocalTime === null) return 1;
      if (b.consumedLocalTime === null) return -1;
      return minutesBetween(b.consumedLocalTime, a.consumedLocalTime);
    });
    let state: SlotState = 'NOT_RECORDED';
    let option: SlotView['option'] = null;
    const conflictingOptionIds: string[] = [];
    if (linked.length > 0) {
      state = 'RECORDED';
      const namedIds = new Set(linked.flatMap((m) => (m.planOptionId ? [m.planOptionId] : [])));
      if (slot.options.length <= 1) {
        option = slot.options[0] ?? null;
      } else if (namedIds.size === 0) {
        // No option named: a different food under the slot (B3), unless the items
        // overlap an option — then the choice is still owed (an option removed by a plan edit).
        const items = linked.flatMap((m) => m.items);
        if (optionRequiredFor(items, slot)) state = 'NEEDS_REVIEW';
      } else if (namedIds.size === 1) {
        option = slot.options.find((o) => namedIds.has(o.id)) ?? null;
        if (!option) state = 'NEEDS_REVIEW';
      } else {
        state = 'NEEDS_REVIEW';
        for (const id of namedIds) conflictingOptionIds.push(id);
      }
    } else if (skipped.has(slot.id)) {
      state = 'SKIPPED';
    }
    const energyTarget =
      input.targets.find((t) => t.planSlotId === slot.id && t.nutrient === 'ENERGY_KCAL') ?? null;
    const window = windowFor(slot);
    return {
      slot,
      state,
      mealIds: linked.map((m) => m.id),
      option,
      conflictingOptionIds,
      earliestTime: earliestTime(linked),
      match: null,
      portion: null,
      timing: null,
      slotEnergy: null,
      recordedEnergyKcal: null,
      score: null,
      energyTarget,
      window,
      windowState: windowStateFor(input, window),
    };
  });

  // Step 5: comparisons per resolved slot.
  const orderEntries: OrderEntry[] = views
    .filter((v) => v.state === 'RECORDED' && referenceOption(v))
    .map((v) => ({ slot: v.slot, time: v.earliestTime }));

  for (const view of views) {
    const reference = view.state === 'RECORDED' ? referenceOption(view) : null;
    if (!reference) continue;
    const linked = view.mealIds.map((id) => meals.find((m) => m.id === id)!);
    const items = linked.flatMap((m) => m.items);
    view.match = matchSlot(items, reference, view.slot, input.allSlots);
    view.portion = portionResult(view.match);
    const window = statedWindow(view.slot);
    view.timing = window
      ? timeResult(view.earliestTime, window)
      : orderResult(view.slot, orderEntries);
    const energy = nutritionSubtotals(items).find((s) => s.nutrient === 'ENERGY_KCAL');
    view.recordedEnergyKcal = energy?.value ?? null;
    if (view.energyTarget && energy && energy.value !== null && energy.complete) {
      view.slotEnergy = energyResult(energy.value, view.energyTarget);
    }
    view.score = scoreSlot(view.match, view.portion, view.timing);
  }

  // Step 7: nutrition subtotals over every meal once.
  const allItems = meals.flatMap((m) => m.items);
  const subtotals = nutritionSubtotals(allItems);
  const energySubtotal = subtotals.find((s) => s.nutrient === 'ENERGY_KCAL')!;
  const dailyEnergyTarget = dailyTargetFor(input.targets, 'ENERGY_KCAL');
  const { component, energy: dailyEnergy } = nutritionComponent(
    energySubtotal,
    dailyEnergyTarget,
    dayPhase,
    logComplete,
  );
  const nutrition = subtotals.map((s) =>
    compareTarget(s, dailyTargetFor(input.targets, s.nutrient), dayPhase, logComplete),
  );

  // Step 6: day score.
  const coverage: Coverage = {
    prescribed: views.length,
    recorded: views.filter((v) => v.state === 'RECORDED' || v.state === 'NEEDS_REVIEW').length,
    scored: views.filter((v) => v.score?.score !== null && v.score !== null).length,
    skipped: views.filter((v) => v.state === 'SKIPPED').length,
    needsReview: views.filter((v) => v.state === 'NEEDS_REVIEW').length,
    notRecorded: views.filter((v) => v.state === 'NOT_RECORDED').length,
  };
  const completeByDefault =
    dayPhase === 'PAST' && logComplete && meals.length > 0 && coverage.notRecorded > 0;
  const scores = views.map((v) => v.score?.score).filter((s): s is number => typeof s === 'number');
  const score = scoreDay(scores, meals.length > 0 ? component : null, coverage, completeByDefault);

  const trendEligible =
    dayPhase === 'PAST' &&
    logComplete &&
    meals.length > 0 &&
    coverage.notRecorded === 0 &&
    coverage.needsReview === 0;

  const timeline = views
    .filter(
      (v) => v.earliestTime !== null && (v.state === 'RECORDED' || v.state === 'NEEDS_REVIEW'),
    )
    .map((v) => ({ slotId: v.slot.id, time: v.earliestTime as string }))
    .sort((a, b) => minutesBetween(b.time, a.time));

  return {
    rubricVersion: RUBRIC_VERSION,
    localDate: input.localDate,
    zone: input.zone,
    dayPhase,
    logComplete,
    hasRecord: input.hasRecord,
    planStructure: input.planStructure,
    slots: views,
    otherMealIds,
    mealCount: meals.length,
    contributing: meals.map((m) => ({ mealId: m.id, revision: m.revision })),
    score,
    nutrition,
    dailyEnergy,
    trendEligible,
    timeline,
  };
}
