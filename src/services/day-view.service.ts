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
import { sevenDaySummary, type SevenDaySummary } from '@/lib/rubric/seven-day';
import type {
  DayInput,
  DayView,
  FoodCategoryKey,
  FoodName,
  RubricAlternative,
  RubricFoodItem,
  RubricMeal,
  RubricTarget,
} from '@/lib/rubric/types';
import { addDays, dateRange, localDateFor, weekdayOf } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { nutritionSchema, type Nutrition } from '@/lib/validations/nutrition';
import { getActivePlan, slotsForWeekday, type ActivePlan } from '@/services/plan.service';
import { DEFAULT_WEEK_START, getProfile } from '@/services/profile.service';

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
  weekStart: number;
  plan: ActivePlan | null;
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
    unitGrams: toNumber(row.unitGrams),
    quantityUnknown: row.quantityUnknown,
    category: row.category as FoodCategoryKey,
    alternatives: parseAlternatives(row.alternatives),
    matchedPlanItemId: row.matchedPlanItemId,
    isAddedItem: row.isAddedItem,
    nutrition: parseNutrition(row.nutrition),
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

/**
 * A confirmation inside the window counts as a change only when a plan was
 * already in force before it; a first plan has nothing to differ from. The
 * schema keeps no confirmation history and `Plan.createdAt` is the first
 * draft, not the first confirmation, so "first" is read as: confirmed on the
 * local day the row was created (an import is confirmed minutes after it was
 * started; edits and replacements come later). A first plan reviewed
 * overnight is the one case still labelled a change.
 */
function planChangedBetween(plan: ActivePlan | null, start: string, end: string): boolean {
  if (!plan?.confirmedAt) return false;
  const confirmed = localDateFor(plan.confirmedAt, APP_TIME_ZONE);
  if (confirmed < start || confirmed > end) return false;
  return localDateFor(plan.createdAt, APP_TIME_ZONE) !== confirmed;
}

// ─── Building one day ───────────────────────────────────────────────────────

interface BuiltDay {
  view: DayView;
  zone: string;
}

/**
 * `DayInput` for one date: stored days keep their own zone; a date without a
 * row is computed as empty in the app zone. `dayPhase` comes from `now`
 * (tech spec § 21.5), so midnight changes the result without any write.
 */
function buildDay(
  localDate: string,
  row: DayRecordRow | null,
  plan: ActivePlan | null,
  now: Date,
): BuiltDay {
  const zone = row?.timeZone ?? APP_TIME_ZONE;
  const weekday = weekdayOf(localDate);
  const active = isPlanActive(plan) ? plan : null;
  const slots = active ? slotsForWeekday(active, weekday) : [];
  const slotIds = new Set(slots.map((s) => s.id));
  const input: DayInput = {
    localDate,
    zone,
    dayPhase: localDate >= localDateFor(now, zone) ? 'ONGOING' : 'PAST',
    logComplete: row?.logComplete ?? true,
    hasRecord: row !== null,
    planStructure: active?.structure ?? null,
    slots,
    allSlots: active?.slots ?? [],
    meals: (row?.meals ?? []).map(toRubricMeal),
    skippedSlotIds: (row?.skippedSlots ?? []).map((s) => s.planSlotId),
    targets: targetsFor(active, weekday, slotIds),
  };
  return { view: computeDayView(input), zone };
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
  now: Date,
): BuiltDay[] {
  return dateRange(start, end).map((date) => buildDay(date, rows.get(date) ?? null, plan, now));
}

// ─── Public reads ───────────────────────────────────────────────────────────

/**
 * One day, computed on read (tech spec § 17: the day with its meals, items and
 * skips, the plan and the profile load in parallel).
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
  const day = buildDay(localDate, row, plan, now);

  return {
    view: day.view,
    meals: (row?.meals ?? []).map((m) => toMealSummary(m, isPlanActive(plan) ? plan : null)),
    zone: day.zone,
    weekStart: profile?.weekStart ?? DEFAULT_WEEK_START,
    plan,
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
  const active = isPlanActive(plan) ? plan : null;
  const rows = await loadDays(ownerId, startDate, endDate);
  const built = buildRange(startDate, endDate, rows, plan, now);

  const historyStart = historyStartFor(
    startDate,
    profile ? localDateFor(profile.createdAt, APP_TIME_ZONE) : null,
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
    planChangedInWindow: planChangedBetween(active, startDate, endDate),
  };
}
