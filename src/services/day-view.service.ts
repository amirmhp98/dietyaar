import type {
  DayRecord,
  DaySkippedSlot,
  FoodItem,
  Meal,
  MealInputKind,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeDayView } from '@/lib/rubric/day-view';
import { nutritionSubtotals } from '@/lib/rubric/nutrition';
import { ruleObservation, type RuleDay } from '@/lib/rubric/rules';
import { sevenDaySummary, type SevenDaySummary } from '@/lib/rubric/seven-day';
import type {
  DayInput,
  DayView,
  FoodCategoryKey,
  FoodName,
  RubricAlternative,
  RubricFoodItem,
  RubricMeal,
  RubricRule,
  RubricTarget,
  RuleObservation,
} from '@/lib/rubric/types';
import { addDays, dateRange, localDateFor, weekBounds, weekdayOf } from '@/lib/time/local-date';
import { nutritionSchema, type Nutrition } from '@/lib/validations/nutrition';
import { getActivePlan, slotsForWeekday, type ActivePlan } from '@/services/plan.service';
import {
  DEFAULT_TIME_ZONE,
  DEFAULT_WEEK_START,
  getProfile,
  type ProfileView,
} from '@/services/profile.service';

/**
 * Day read model (tech spec § 6, decision 013): the comparison is computed on
 * read from the day's rows, the current plan and `now`. Nothing derived is
 * stored. Writes (skips, completeness, DayRecord creation) live in
 * `day.service.ts`.
 */

export interface MealSummary {
  id: string;
  revision: number;
  consumedLocalTime: string | null;
  inputKind: MealInputKind;
  planSlotId: string | null;
  planOptionId: string | null;
  /** The linked slot's names, or null for "Other". */
  slot: FoodName | null;
  optionLabel: string | null;
  optionPosition: number | null;
  /** The first items, for the row label. */
  itemNames: FoodName[];
  itemCount: number;
  energyKcal: number | null;
  photoCount: number;
  notes: string | null;
}

export interface DayViewResult {
  view: DayView;
  meals: MealSummary[];
  /** The zone the day was computed in (the stored one for historical days). */
  zone: string;
  profileZone: string;
  weekStart: number;
  plan: ActivePlan | null;
  /** True when the plan's `confirmedAt` falls inside the anchored week of a weekly rule. */
  planChangedInPeriod: boolean;
}

export type DayRowState =
  'IN_PROGRESS' | 'NO_MEALS' | 'INCOMPLETE' | 'COMPLETE_BY_DEFAULT' | 'COMPLETE';

export interface DayRow {
  localDate: string;
  state: DayRowState;
  view: DayView;
}

export interface SevenDayResult {
  startDate: string;
  endDate: string;
  /** The window's days from `historyStart` on, oldest first. */
  rows: DayRow[];
  /**
   * The first listed day when it lies inside the window: the account's
   * first day, or an earlier day the user logged a meal for. Null when all
   * seven days are listed.
   */
  historyStart: string | null;
  summary: SevenDaySummary;
  planChangedInWindow: boolean;
  /** Weekly rules over the anchored week containing `endDate`. */
  weeklyRules: RuleProgress[];
  profileZone: string;
}

export interface RuleProgress {
  rule: ActivePlan['rules'][number];
  observation: RuleObservation;
  periodStart: string;
  periodEnd: string;
  planChangedInPeriod: boolean;
}

// ─── Row → rubric conversion (Decimal → number at the boundary) ────────────

type MealRow = Meal & { items: FoodItem[]; uploads?: Array<{ id: string }> };
type DayRecordRow = DayRecord & { meals: MealRow[]; skippedSlots: DaySkippedSlot[] };

const dayInclude = {
  meals: {
    orderBy: [{ consumedLocalTime: 'asc' }, { createdAt: 'asc' }],
    include: {
      items: { orderBy: { position: 'asc' } },
      uploads: { select: { id: true } },
    },
  },
  skippedSlots: true,
} satisfies Prisma.DayRecordInclude;

function toNumber(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

function parseNutrition(value: Prisma.JsonValue | null): Nutrition | null {
  if (value === null || typeof value !== 'object') return null;
  const parsed = nutritionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseAlternatives(value: Prisma.JsonValue): RubricAlternative[] {
  if (!Array.isArray(value)) return [];
  const out: RubricAlternative[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const o = entry as Record<string, Prisma.JsonValue | undefined>;
    if (typeof o.originalName !== 'string' || typeof o.englishLabel !== 'string') continue;
    out.push({
      originalName: o.originalName,
      englishLabel: o.englishLabel,
      nutrition: parseNutrition(o.nutrition ?? null),
    });
  }
  return out;
}

export function toRubricFoodItem(row: FoodItem): RubricFoodItem {
  return {
    id: row.id,
    originalName: row.originalName,
    englishLabel: row.englishLabel,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    quantityUnknown: row.quantityUnknown,
    category: row.category as FoodCategoryKey,
    alternatives: parseAlternatives(row.alternatives),
    matchedPlanItemId: row.matchedPlanItemId,
    isAddedItem: row.isAddedItem,
    nutrition: parseNutrition(row.nutrition),
    ruleGroups: row.ruleGroups,
  };
}

export function toRubricMeal(row: MealRow): RubricMeal {
  return {
    id: row.id,
    revision: row.revision,
    planSlotId: row.planSlotId,
    planOptionId: row.planOptionId,
    consumedLocalTime: row.consumedLocalTime,
    items: row.items.map(toRubricFoodItem),
  };
}

function energyOf(items: RubricFoodItem[]): number | null {
  const energy = nutritionSubtotals(items).find((s) => s.nutrient === 'ENERGY_KCAL');
  return energy?.value === null || energy?.value === undefined ? null : Math.round(energy.value);
}

function toMealSummary(row: MealRow, plan: ActivePlan | null): MealSummary {
  const meal = toRubricMeal(row);
  const slot = plan?.slots.find((s) => s.id === row.planSlotId) ?? null;
  const option = slot?.options.find((o) => o.id === row.planOptionId) ?? null;
  return {
    id: row.id,
    revision: row.revision,
    consumedLocalTime: row.consumedLocalTime,
    inputKind: row.inputKind,
    planSlotId: row.planSlotId,
    planOptionId: row.planOptionId,
    slot: slot ? { originalName: slot.originalName, englishLabel: slot.englishLabel } : null,
    optionLabel: option?.label ?? null,
    optionPosition: option?.position ?? null,
    itemNames: meal.items
      .slice(0, 3)
      .map((i) => ({ originalName: i.originalName, englishLabel: i.englishLabel })),
    itemCount: meal.items.length,
    energyKcal: energyOf(meal.items),
    photoCount: row.uploads?.length ?? 0,
    notes: row.notes,
  };
}

// ─── Plan helpers ───────────────────────────────────────────────────────────

/** A plan with confirmed rows the day can be compared against. */
export function isPlanActive(plan: ActivePlan | null): plan is ActivePlan {
  return plan !== null && plan.status !== 'NONE' && plan.structure !== null;
}

function targetsFor(
  plan: ActivePlan | null,
  weekday: number,
  slotIds: Set<string>,
): RubricTarget[] {
  if (!isPlanActive(plan)) return [];
  return plan.targets
    .filter((t) =>
      t.planSlotId === null
        ? t.weekday === null || t.weekday === 7 || t.weekday === weekday
        : slotIds.has(t.planSlotId),
    )
    .map((t) => ({
      planSlotId: t.planSlotId,
      nutrient: t.nutrient,
      type: t.type,
      low: t.low,
      high: t.high,
      source: t.source,
    }));
}

function trackedRules(plan: ActivePlan | null): ActivePlan['rules'] {
  return isPlanActive(plan) ? plan.rules.filter((r) => r.tracking === 'TRACK') : [];
}

function hasWeeklyRule(plan: ActivePlan | null): boolean {
  return trackedRules(plan).some((r) => r.period === 'WEEK');
}

/**
 * A confirmation inside the window counts as a change only when a plan was
 * already in force before it; a first plan has nothing to differ from. The
 * schema keeps no confirmation history and `Plan.createdAt` is the first
 * draft, not the first confirmation, so "first" is read as: confirmed on the
 * local day the row was created (an import is confirmed minutes after it was
 * started; edits and replacements come later). A first plan reviewed
 * overnight is the one case still labelled a change.
 */
function planChangedBetween(
  plan: ActivePlan | null,
  start: string,
  end: string,
  zone: string,
): boolean {
  if (!plan?.confirmedAt) return false;
  const confirmed = localDateFor(plan.confirmedAt, zone);
  if (confirmed < start || confirmed > end) return false;
  return localDateFor(plan.createdAt, zone) !== confirmed;
}

// ─── Building one day ───────────────────────────────────────────────────────

interface Settings {
  zone: string;
  weekStart: number;
}

function settingsOf(profile: ProfileView | null): Settings {
  return {
    zone: profile?.timeZone ?? DEFAULT_TIME_ZONE,
    weekStart: profile?.weekStart ?? DEFAULT_WEEK_START,
  };
}

interface BuiltDay {
  view: DayView;
  meals: RubricMeal[];
  zone: string;
}

/**
 * `DayInput` for one date: stored days keep their own zone; a date without a
 * row is computed as empty in the profile zone. `dayPhase` comes from `now`
 * (tech spec § 21.5), so midnight changes the result without any write.
 */
function buildDay(
  localDate: string,
  row: DayRecordRow | null,
  plan: ActivePlan | null,
  settings: Settings,
  now: Date,
): BuiltDay {
  const zone = row?.timeZone ?? settings.zone;
  const weekday = weekdayOf(localDate);
  const active = isPlanActive(plan) ? plan : null;
  const slots = active ? slotsForWeekday(active, weekday) : [];
  const slotIds = new Set(slots.map((s) => s.id));
  const meals = (row?.meals ?? []).map(toRubricMeal);
  const rules: RubricRule[] = trackedRules(active);
  const input: DayInput = {
    localDate,
    zone,
    dayPhase: localDate >= localDateFor(now, zone) ? 'ONGOING' : 'PAST',
    logComplete: row?.logComplete ?? true,
    hasRecord: row !== null,
    planStructure: active?.structure ?? null,
    slots,
    allSlots: active?.slots ?? [],
    meals,
    skippedSlotIds: (row?.skippedSlots ?? []).map((s) => s.planSlotId),
    targets: targetsFor(active, weekday, slotIds),
    rules,
  };
  return { view: computeDayView(input), meals, zone };
}

function ruleDayOf(day: BuiltDay): RuleDay {
  return {
    localDate: day.view.localDate,
    items: day.meals.flatMap((m) => m.items),
    mealItems: day.meals.map((m) => m.items),
    logComplete: day.view.logComplete,
    complete: day.view.trendEligible,
    weekday: weekdayOf(day.view.localDate),
  };
}

async function loadDay(ownerId: string, localDate: string): Promise<DayRecordRow | null> {
  return prisma.dayRecord.findUnique({
    where: { userId_localDate: { userId: ownerId, localDate } },
    include: dayInclude,
  });
}

/** Days, meals and items of an inclusive date range in one query, keyed by date. */
async function loadDays(
  ownerId: string,
  start: string,
  end: string,
): Promise<Map<string, DayRecordRow>> {
  const rows = await prisma.dayRecord.findMany({
    where: { userId: ownerId, localDate: { gte: start, lte: end } },
    include: dayInclude,
  });
  return new Map(rows.map((r) => [r.localDate, r]));
}

/** Every day of `[start, end]`, built from the loaded rows (missing dates are empty). */
function buildRange(
  start: string,
  end: string,
  rows: Map<string, DayRecordRow>,
  plan: ActivePlan | null,
  settings: Settings,
  now: Date,
): BuiltDay[] {
  return dateRange(start, end).map((date) =>
    buildDay(date, rows.get(date) ?? null, plan, settings, now),
  );
}

/**
 * Weekly rules over the anchored week containing `localDate` (review finding
 * 13): the rubric scores one day at a time, so the service assembles the week.
 * `periodEnded` when the week's last day is before today in the profile zone.
 */
function weeklyObservations(
  plan: ActivePlan,
  localDate: string,
  week: BuiltDay[],
  settings: Settings,
  now: Date,
): { observations: Map<string, RuleObservation>; planChanged: boolean } {
  const { start, end } = weekBounds(localDate, settings.weekStart);
  const today = localDateFor(now, settings.zone);
  const periodEnded = end < today;
  const days = week.map(ruleDayOf);
  const observations = new Map<string, RuleObservation>();
  for (const rule of trackedRules(plan)) {
    if (rule.period !== 'WEEK') continue;
    observations.set(rule.id, ruleObservation(rule, days, periodEnded));
  }
  return { observations, planChanged: planChangedBetween(plan, start, end, settings.zone) };
}

function mergeWeekly(view: DayView, weekly: Map<string, RuleObservation>): DayView {
  if (weekly.size === 0) return view;
  return { ...view, rules: [...view.rules, ...weekly.values()] };
}

// ─── Public reads ───────────────────────────────────────────────────────────

/**
 * One day, computed on read (tech spec § 17: the day with its meals, items and
 * skips, the plan and the profile load in parallel). When the plan tracks a
 * weekly rule, the anchored week loads in one more range query.
 */
export async function getDayView(
  ownerId: string,
  localDate: string,
  now: Date,
): Promise<DayViewResult> {
  const [row, plan, profile] = await Promise.all([
    loadDay(ownerId, localDate),
    getActivePlan(ownerId),
    getProfile(ownerId),
  ]);
  const settings = settingsOf(profile);
  const day = buildDay(localDate, row, plan, settings, now);
  let view = day.view;
  let planChangedInPeriod = false;

  if (isPlanActive(plan) && hasWeeklyRule(plan)) {
    const { start, end } = weekBounds(localDate, settings.weekStart);
    const rows = await loadDays(ownerId, start, end);
    const week = buildRange(start, end, rows, plan, settings, now).map((d) =>
      d.view.localDate === localDate ? day : d,
    );
    const weekly = weeklyObservations(plan, localDate, week, settings, now);
    view = mergeWeekly(view, weekly.observations);
    planChangedInPeriod = weekly.planChanged;
  }

  return {
    view,
    meals: (row?.meals ?? []).map((m) => toMealSummary(m, isPlanActive(plan) ? plan : null)),
    zone: day.zone,
    profileZone: settings.zone,
    weekStart: settings.weekStart,
    plan,
    planChangedInPeriod,
  };
}

/** The label state of a History row (product spec § 8 "Day completeness", § 10). */
export function dayRowState(view: DayView): DayRowState {
  if (view.dayPhase === 'ONGOING') return 'IN_PROGRESS';
  if (view.mealCount === 0) return 'NO_MEALS';
  if (!view.logComplete) return 'INCOMPLETE';
  if (view.score.completeByDefault) return 'COMPLETE_BY_DEFAULT';
  return 'COMPLETE';
}

/**
 * The first day History lists: days before the account existed carry no
 * information, unless the user logged a meal for one (backdating is allowed).
 */
export function historyStartFor(
  windowStart: string,
  accountStart: string | null,
  recordedDates: string[],
): string | null {
  if (accountStart === null) return null;
  const start = [accountStart, ...recordedDates].reduce((a, b) => (a < b ? a : b));
  return start > windowStart ? start : null;
}

/**
 * Seven days ending at `endDate` in one range query plus the plan and profile
 * (tech spec § 17 "History 7 days"). The pattern summary counts only
 * trend-eligible days; a plan confirmed inside the window is labelled; days
 * before the account existed are left out.
 */
export async function getSevenDayView(
  ownerId: string,
  endDate: string,
  now: Date,
): Promise<SevenDayResult> {
  const startDate = addDays(endDate, -6);
  const [plan, profile] = await Promise.all([getActivePlan(ownerId), getProfile(ownerId)]);
  const settings = settingsOf(profile);
  const active = isPlanActive(plan) ? plan : null;
  // The anchored week containing endDate starts at most six days earlier, so one range covers both.
  const week = active && hasWeeklyRule(active) ? weekBounds(endDate, settings.weekStart) : null;
  const rangeStart = week && week.start < startDate ? week.start : startDate;
  const rangeEnd = week && week.end > endDate ? week.end : endDate;
  const rows = await loadDays(ownerId, rangeStart, rangeEnd);
  const built = buildRange(rangeStart, rangeEnd, rows, plan, settings, now);

  const weeklyRules: RuleProgress[] = [];
  if (active && week) {
    const weekDays = built.filter(
      (d) => d.view.localDate >= week.start && d.view.localDate <= week.end,
    );
    const weekly = weeklyObservations(active, endDate, weekDays, settings, now);
    for (const rule of trackedRules(active)) {
      const observation = weekly.observations.get(rule.id);
      if (!observation) continue;
      weeklyRules.push({
        rule,
        observation,
        periodStart: week.start,
        periodEnd: week.end,
        planChangedInPeriod: weekly.planChanged,
      });
    }
  }

  const historyStart = historyStartFor(
    startDate,
    profile ? localDateFor(profile.createdAt, settings.zone) : null,
    [...rows.keys()],
  );
  const rows7 = built
    .filter((d) => d.view.localDate >= (historyStart ?? startDate) && d.view.localDate <= endDate)
    .map((d) => ({ localDate: d.view.localDate, state: dayRowState(d.view), view: d.view }));
  return {
    startDate,
    endDate,
    rows: rows7,
    historyStart,
    summary: sevenDaySummary(rows7.map((r) => r.view)),
    planChangedInWindow: planChangedBetween(active, startDate, endDate, settings.zone),
    weeklyRules,
    profileZone: settings.zone,
  };
}

/**
 * Current-period progress for every tracked rule (My plan): daily rules over
 * today, weekly rules over the anchored week containing today.
 */
export async function getRuleProgress(ownerId: string, now: Date): Promise<RuleProgress[]> {
  const [plan, profile] = await Promise.all([getActivePlan(ownerId), getProfile(ownerId)]);
  const active = isPlanActive(plan) ? plan : null;
  const rules = trackedRules(active);
  if (!active || rules.length === 0) return [];
  const settings = settingsOf(profile);
  const today = localDateFor(now, settings.zone);
  const week = weekBounds(today, settings.weekStart);
  const rows = await loadDays(ownerId, week.start, week.end);
  const built = buildRange(week.start, week.end, rows, active, settings, now);
  const todayDay = built.find((d) => d.view.localDate === today);
  const weekly = weeklyObservations(active, today, built, settings, now);
  const dailyChanged = planChangedBetween(active, today, today, settings.zone);

  const out: RuleProgress[] = [];
  for (const rule of rules) {
    if (rule.period === 'WEEK') {
      const observation = weekly.observations.get(rule.id);
      if (observation)
        out.push({
          rule,
          observation,
          periodStart: week.start,
          periodEnd: week.end,
          planChangedInPeriod: weekly.planChanged,
        });
      continue;
    }
    const observation = todayDay?.view.rules.find((r) => r.ruleId === rule.id);
    if (observation)
      out.push({
        rule,
        observation,
        periodStart: today,
        periodEnd: today,
        planChangedInPeriod: dailyChanged,
      });
  }
  return out;
}
