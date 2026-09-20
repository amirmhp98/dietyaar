import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type FoodItem, type Meal, type MealDraft } from '@prisma/client';
import { z } from 'zod';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/t';
import { bestOption, matchSlot, optionRequiredFor } from '@/lib/rubric/match-slot';
import { foodKey, sameFood } from '@/lib/rubric/names';
import { restrictionHits } from '@/lib/rubric/restrictions';
import type {
  MatchResult,
  RubricAlternative,
  RubricFoodItem,
  RubricOption,
  RubricSlot,
} from '@/lib/rubric/types';
import {
  isFutureLocalDateTime,
  localDateFor,
  localTimeFor,
  weekdayOf,
} from '@/lib/time/local-date';
import {
  type CreateMealDraftInput,
  type DraftFoodItem,
  type DraftQuestion,
  type MealAnalysisMode,
  type MealDraftEdits,
  type MealDraftState,
  draftFoodItemSchema,
  mealDraftStateSchema,
  toRubricItem,
} from '@/lib/validations/meal';
import { alternativeSchema } from '@/lib/validations/plan';
import { type Nutrition, nutritionSchema } from '@/lib/validations/nutrition';
import type { MealAnalysisOutput } from '@/services/ai/schemas';
import { analyzeMeal } from '@/services/ai/analyze-meal';
import type { AiKind, AiResult, MealPlanContext, MealRefineContext } from '@/services/ai/types';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import { toRubricFoodItem } from '@/services/day-view.service';
import { scaleNutrition } from '@/services/food-data/scale';
import { type ActivePlan, getActivePlan, slotsForWeekday } from '@/services/plan.service';
import { DEFAULT_TIME_ZONE, getProfile } from '@/services/profile.service';
import { markStaleIfNeeded } from '@/services/reflection.service';
import { deleteObjects } from '@/services/storage/s3';
import { deleteStagedUpload, readStagedImages } from '@/services/upload.service';

/**
 * Meal module (tech spec § 5 Meal / MealDraft, § 7 "Meal", § 21.8–10).
 * Drafts are server-held and versioned; `saveMeal` is the confirmation
 * boundary. Every function takes the owner id first and scopes its root
 * query by it. Times are explicit (`now`); zones come from the profile.
 */

/** A draft lives 24 h after its last edit; its staged uploads expire with it. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** One meal analysis shares one 45 s deadline (tech spec § 10.2). */
export const MEAL_ANALYSIS_DEADLINE_MS = 45_000;
/** Composer lookups are cached per user for 60 s (tech spec § 17). */
export const RECENT_MEALS_CACHE_MS = 60_000;

// ─── Views ─────────────────────────────────────────────────────────────────

export interface MealDraftView {
  id: string;
  clientRequestId: string;
  revision: number;
  state: MealDraftState;
  analysisStatus: 'NONE' | 'RUNNING' | 'DONE' | 'FAILED';
  analysisFailureReason: string | null;
  expiresAt: Date;
}

/** What the review shows next to the items: the same slot match Today will compute. */
export interface DraftPreview {
  match: MatchResult | null;
}

export interface MealFoodItemView {
  id: string;
  position: number;
  originalName: string;
  englishLabel: string;
  quantity: number | null;
  unit: string | null;
  quantityUnknown: boolean;
  quantityAssumed: boolean;
  preparation: string | null;
  category: DraftFoodItem['category'];
  alternatives: RubricAlternative[];
  matchedPlanItemId: string | null;
  isAddedItem: boolean;
  restrictionHit: string | null;
  nutrition: Nutrition | null;
}

export interface MealView {
  id: string;
  revision: number;
  clientRequestId: string;
  localDate: string;
  timeZone: string;
  consumedLocalTime: string | null;
  inputKind: Meal['inputKind'];
  originalText: string | null;
  notes: string | null;
  copiedFromMealId: string | null;
  planSlotId: string | null;
  planOptionId: string | null;
  planSlot: { originalName: string; englishLabel: string } | null;
  planOptionLabel: string | null;
  linkConfirmedByUser: boolean;
  items: MealFoodItemView[];
  uploads: Array<{ id: string; position: number | null; width: number; height: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecentMeal {
  id: string;
  localDate: string;
  consumedLocalTime: string | null;
  planSlotId: string | null;
  planOptionId: string | null;
  items: Array<{ originalName: string; englishLabel: string }>;
  energyKcal: number | null;
}

export type CreateDraftResult =
  { draft: MealDraftView; meal: null } | { draft: null; meal: MealView };

/** `saveMeal`: the meal plus how many staged photos had expired and were left out. */
export type SaveMealResult = MealView & { droppedPhotos: number };

// ─── Shared helpers ────────────────────────────────────────────────────────

const MEAL_INCLUDE = {
  items: { orderBy: { position: 'asc' } },
  uploads: { where: { status: 'ATTACHED' }, orderBy: { position: 'asc' } },
  day: true,
  planSlot: { select: { originalName: true, englishLabel: true } },
  planOption: { select: { label: true } },
} satisfies Prisma.MealInclude;

type MealRow = Prisma.MealGetPayload<{ include: typeof MEAL_INCLUDE }>;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function newKey(): string {
  return randomUUID().slice(0, 12);
}

function inputHash(state: Pick<MealDraftState, 'kind' | 'text' | 'uploadIds'>): string {
  return sha256(JSON.stringify([state.kind, state.text ?? '', state.uploadIds]));
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function conflict(currentRevision: number): ServiceError {
  return new ServiceError(t('meal.errors.conflict'), 'CONFLICT', { currentRevision });
}

function notFound(message = t('errors.notFound')): ServiceError {
  return new ServiceError(message, 'NOT_FOUND');
}

async function ownerContext(ownerId: string) {
  const profile = await getProfile(ownerId);
  const zone = profile?.timeZone ?? DEFAULT_TIME_ZONE;
  const originals = profile?.restrictionsOriginal ?? [];
  const normalized = profile?.restrictions ?? [];
  const restrictions = (originals.length ? originals : normalized).map((original, i) => ({
    original,
    normalized: normalized[i] ?? original,
  }));
  return { zone, restrictions };
}

function parseNutrition(value: unknown): Nutrition | null {
  const parsed = nutritionSchema.nullable().safeParse(value ?? null);
  return parsed.success ? parsed.data : null;
}

function parseAlternatives(value: unknown): RubricAlternative[] {
  const parsed = z.array(alternativeSchema).safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

/** A confirmed FoodItem row as a draft item, keyed by its row id (edit mode). */
function rowToDraftItem(row: FoodItem): DraftFoodItem {
  return draftFoodItemSchema.parse({
    key: row.id,
    position: row.position,
    originalName: row.originalName,
    englishLabel: row.englishLabel,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    quantityUnknown: row.quantityUnknown,
    quantityAssumed: row.quantityAssumed,
    preparation: row.preparation,
    category: row.category,
    alternatives: parseAlternatives(row.alternatives),
    nutrition: parseNutrition(row.nutrition),
    matchedPlanItemId: row.matchedPlanItemId,
    isAddedItem: row.isAddedItem,
  });
}

function rowToItemView(row: FoodItem): MealFoodItemView {
  return {
    id: row.id,
    position: row.position,
    originalName: row.originalName,
    englishLabel: row.englishLabel,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    quantityUnknown: row.quantityUnknown,
    quantityAssumed: row.quantityAssumed,
    preparation: row.preparation,
    category: row.category,
    alternatives: parseAlternatives(row.alternatives),
    matchedPlanItemId: row.matchedPlanItemId,
    isAddedItem: row.isAddedItem,
    restrictionHit: row.restrictionHit,
    nutrition: parseNutrition(row.nutrition),
  };
}

function toMealView(row: MealRow): MealView {
  return {
    id: row.id,
    revision: row.revision,
    clientRequestId: row.clientRequestId,
    localDate: row.day.localDate,
    timeZone: row.day.timeZone,
    consumedLocalTime: row.consumedLocalTime,
    inputKind: row.inputKind,
    originalText: row.originalText,
    notes: row.notes,
    copiedFromMealId: row.copiedFromMealId,
    planSlotId: row.planSlotId,
    planOptionId: row.planOptionId,
    planSlot: row.planSlot,
    planOptionLabel: row.planOption?.label ?? null,
    linkConfirmedByUser: row.linkConfirmedByUser,
    items: row.items.map(rowToItemView),
    uploads: row.uploads.map((u) => ({
      id: u.id,
      position: u.position,
      width: u.width,
      height: u.height,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDraftView(row: MealDraft): MealDraftView {
  return {
    id: row.id,
    clientRequestId: row.clientRequestId,
    revision: row.revision,
    state: mealDraftStateSchema.parse(row.state),
    analysisStatus: row.analysisStatus,
    analysisFailureReason: row.analysisFailureReason,
    expiresAt: row.expiresAt,
  };
}

function computeRestrictionHits(
  items: DraftFoodItem[],
  restrictions: Array<{ original: string; normalized: string }>,
): MealDraftState['restrictionHits'] {
  if (restrictions.length === 0) return [];
  return restrictionHits(items.map(toRubricItem), restrictions).map((hit) => ({
    itemKey: hit.itemId,
    restriction: hit.restriction,
  }));
}

/** The slot and option a draft's link resolves to on its date, when both are known. */
function resolveLink(
  plan: ActivePlan | null,
  localDate: string,
  planSlotId: string | null,
  planOptionId: string | null,
): { slot: RubricSlot | null; option: RubricOption | null } {
  if (!plan || !planSlotId) return { slot: null, option: null };
  const slot = slotsForWeekday(plan, weekdayOf(localDate)).find((s) => s.id === planSlotId) ?? null;
  if (!slot) return { slot: null, option: null };
  const option = planOptionId
    ? (slot.options.find((o) => o.id === planOptionId) ?? null)
    : slot.options.length === 1
      ? slot.options[0]
      : null;
  return { slot, option };
}

/** Run the rubric's slot match and write the resulting plan-item links back onto the items. */
function matchAndAnnotate(
  items: DraftFoodItem[],
  plan: ActivePlan | null,
  slot: RubricSlot | null,
  option: RubricOption | null,
): { items: DraftFoodItem[]; match: MatchResult | null } {
  if (!plan || !slot || !option) return { items, match: null };
  const match = matchSlot(items.map(toRubricItem), option, slot, plan.slots);
  const matchedBy = new Map(match.matched.map((m) => [m.item.id, m.planItem.id]));
  const added = new Set(match.added.map((a) => a.id));
  return {
    match,
    items: items.map((item) => ({
      ...item,
      matchedPlanItemId: matchedBy.get(item.key) ?? null,
      isAddedItem: added.has(item.key),
    })),
  };
}

/** `scaleNutrition` keeps PER_100G on a scaled result; the stored shape is per recorded portion. */
function toRecordedPortion(nutrition: Nutrition, item: DraftFoodItem): Nutrition {
  if (nutrition.basis !== 'PER_100G') return nutrition;
  return {
    ...nutrition,
    basis: 'PER_RECORDED_PORTION',
    basisQuantity: item.quantity,
    basisUnit: item.unit,
  };
}

/**
 * Apply the tech spec § 5.1 scaling rules to an edited item against the item
 * it replaces (same key). Server-held nutrition is authoritative; the client
 * only ever supplies values when the user entered them (`userOverride`).
 */
export function reconcileItem(next: DraftFoodItem, prev: DraftFoodItem | undefined): DraftFoodItem {
  if (!prev) return { ...next, scaleFlag: next.scaleFlag ?? null };

  // Rule: a newly entered label value replaces whatever was there and never scales.
  if (
    next.nutrition?.userOverride &&
    JSON.stringify(next.nutrition) !== JSON.stringify(prev.nutrition)
  ) {
    return { ...next, needsReestimate: false, previousNutrition: null, scaleFlag: null };
  }

  // An edited name is a new identity even when the other label still matches
  // (renaming تخم‌مرغ to املت keeps "Egg"); sameFood is for matching, not edits.
  const identityChanged =
    foodKey(next.originalName) !== foodKey(prev.originalName) ||
    foodKey(next.englishLabel) !== foodKey(prev.englishLabel) ||
    (next.preparation ?? '') !== (prev.preparation ?? '') ||
    next.chosenAlternative !== prev.chosenAlternative;

  // Choosing an in-item alternative with its own values starts from those values.
  const alternativeNutrition =
    next.chosenAlternative !== null && next.chosenAlternative !== prev.chosenAlternative
      ? (next.alternatives[next.chosenAlternative]?.nutrition ?? null)
      : null;
  const base = alternativeNutrition ?? prev.nutrition;

  const { nutrition, flag } = scaleNutrition({
    nutrition: base,
    fromQuantity: prev.quantity,
    fromUnit: prev.unit,
    toQuantity: next.quantity,
    toUnit: next.unit,
    identityChanged: identityChanged && alternativeNutrition === null,
  });

  switch (flag) {
    case 'NEEDS_REESTIMATE':
      if (base?.userOverride) {
        return {
          ...next,
          nutrition: base,
          needsReestimate: true,
          previousNutrition: null,
          scaleFlag: flag,
        };
      }
      return {
        ...next,
        nutrition: null,
        needsReestimate: true,
        previousNutrition: base ?? prev.previousNutrition,
        scaleFlag: flag,
      };
    case 'SCALED':
      return {
        ...next,
        nutrition: nutrition ? toRecordedPortion(nutrition, next) : null,
        needsReestimate: prev.needsReestimate,
        previousNutrition: prev.previousNutrition,
        scaleFlag: flag,
      };
    case 'CHECK_VALUE':
    case 'NOT_EVALUATED':
      return {
        ...next,
        nutrition: base,
        needsReestimate: prev.needsReestimate,
        previousNutrition: prev.previousNutrition,
        scaleFlag: flag,
      };
    default:
      return {
        ...next,
        nutrition: base,
        needsReestimate: prev.needsReestimate,
        previousNutrition: prev.previousNutrition,
        scaleFlag: prev.scaleFlag,
      };
  }
}

function reconcileItems(next: DraftFoodItem[], prev: DraftFoodItem[]): DraftFoodItem[] {
  const byKey = new Map(prev.map((item) => [item.key, item]));
  return next.map((item, position) => ({ ...reconcileItem(item, byKey.get(item.key)), position }));
}

function planItemsToDraftItems(option: RubricOption): DraftFoodItem[] {
  return option.items.map((p, position) =>
    draftFoodItemSchema.parse({
      key: newKey(),
      position,
      originalName: p.originalName,
      englishLabel: p.englishLabel,
      quantity: p.quantity,
      unit: p.unit,
      quantityUnknown: false,
      quantityAssumed: p.quantityAssumed,
      category: p.category,
      alternatives: p.alternatives,
      nutrition: p.nutrition,
      matchedPlanItemId: p.id,
    }),
  );
}

function copiedItems(rows: FoodItem[]): DraftFoodItem[] {
  return rows.map((row, position) => ({
    ...rowToDraftItem(row),
    key: newKey(),
    position,
    matchedPlanItemId: null,
    isAddedItem: false,
  }));
}

/** Nutrition stored on a FoodItem row: per recorded portion whenever the unit converts. */
function normaliseForStorage(item: DraftFoodItem): Nutrition | null {
  const n = item.nutrition;
  if (!n || n.basis !== 'PER_100G' || n.userOverride) return n;
  const { nutrition, flag } = scaleNutrition({
    nutrition: n,
    fromQuantity: null,
    fromUnit: null,
    toQuantity: item.quantity,
    toUnit: item.unit,
  });
  return flag === 'SCALED' && nutrition ? toRecordedPortion(nutrition, item) : n;
}

function toFoodItemRows(
  mealId: string,
  items: DraftFoodItem[],
  hits: MealDraftState['restrictionHits'],
): Prisma.FoodItemCreateManyInput[] {
  const hitByKey = new Map(hits.map((h) => [h.itemKey, h.restriction]));
  return items.map((item, position) => ({
    mealId,
    position,
    originalName: item.originalName,
    englishLabel: item.englishLabel,
    quantity: item.quantityUnknown ? null : item.quantity,
    unit: item.unit,
    quantityUnknown: item.quantityUnknown,
    quantityAssumed: item.quantityAssumed,
    preparation: item.preparation,
    category: item.category,
    alternatives: item.alternatives as Prisma.InputJsonValue,
    matchedPlanItemId: item.matchedPlanItemId,
    isAddedItem: item.isAddedItem,
    restrictionHit: hitByKey.get(item.key) ?? null,
    nutrition: jsonOrNull(normaliseForStorage(item)),
  }));
}

async function loadDraft(ownerId: string, draftId: string): Promise<MealDraft> {
  const row = await prisma.mealDraft.findFirst({ where: { id: draftId, userId: ownerId } });
  if (!row) throw notFound(t('meal.errors.draftNotFound'));
  return row;
}

async function loadMeal(ownerId: string, mealId: string): Promise<MealRow> {
  const row = await prisma.meal.findFirst({
    where: { id: mealId, userId: ownerId },
    include: MEAL_INCLUDE,
  });
  if (!row) throw notFound(t('meal.errors.mealNotFound'));
  return row;
}

async function findMealByClientRequestId(
  ownerId: string,
  clientRequestId: string,
): Promise<MealView | null> {
  const row = await prisma.meal.findFirst({
    where: { clientRequestId, userId: ownerId },
    include: MEAL_INCLUDE,
  });
  return row ? toMealView(row) : null;
}

// ─── Drafts ────────────────────────────────────────────────────────────────

/**
 * Idempotent on `clientRequestId` (tech spec § 21.9): the existing draft, or
 * the meal when that request was already saved. PLANNED drafts are prefilled
 * from the chosen option's prescribed portions; RECENT drafts copy the source
 * meal's items.
 */
export async function createDraft(
  ownerId: string,
  input: CreateMealDraftInput,
  now: Date,
): Promise<CreateDraftResult> {
  const existingMeal = await findMealByClientRequestId(ownerId, input.clientRequestId);
  if (existingMeal) return { draft: null, meal: existingMeal };
  const existing = await prisma.mealDraft.findFirst({
    where: { clientRequestId: input.clientRequestId, userId: ownerId },
  });
  if (existing) return { draft: toDraftView(existing), meal: null };

  const [{ restrictions }, plan] = await Promise.all([
    ownerContext(ownerId),
    getActivePlan(ownerId),
  ]);
  const { slot, option } = resolveLink(plan, input.localDate, input.planSlotId, input.planOptionId);

  let items: DraftFoodItem[] = [];
  let copiedFromMealId: string | null = null;
  if (input.kind === 'PLANNED' && option) {
    items = planItemsToDraftItems(option);
  } else if (input.kind === 'RECENT' && input.copiedFromMealId) {
    const source = await loadMeal(ownerId, input.copiedFromMealId);
    items = copiedItems(source.items);
    copiedFromMealId = source.id;
  }
  const annotated = matchAndAnnotate(items, plan, slot, option);

  const state: MealDraftState = mealDraftStateSchema.parse({
    kind: input.kind,
    text: input.text ?? null,
    uploadIds: input.uploadIds,
    localDate: input.localDate,
    time: input.time,
    planSlotId: slot ? slot.id : null,
    planOptionId: option ? option.id : null,
    notes: null,
    items: annotated.items,
    questions: [],
    copiedFromMealId,
    restrictionHits: computeRestrictionHits(annotated.items, restrictions),
  });

  try {
    const row = await prisma.mealDraft.create({
      data: {
        userId: ownerId,
        clientRequestId: input.clientRequestId,
        state: state as Prisma.InputJsonValue,
        analysisInputHash: inputHash(state),
        expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
      },
    });
    return { draft: toDraftView(row), meal: null };
  } catch (error) {
    // Two concurrent creates with one clientRequestId: the loser returns the winner's draft.
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.mealDraft.findFirst({
      where: { clientRequestId: input.clientRequestId, userId: ownerId },
    });
    if (raced) return { draft: toDraftView(raced), meal: null };
    const meal = await findMealByClientRequestId(ownerId, input.clientRequestId);
    if (meal) return { draft: null, meal };
    throw error;
  }
}

export async function getDraft(ownerId: string, draftId: string): Promise<MealDraftView> {
  return toDraftView(await loadDraft(ownerId, draftId));
}

/**
 * Apply review edits: revision + 1 (CONFLICT on mismatch), items rescaled
 * against the ones they replace, restriction reminders and the plan link
 * recomputed, the input hash refreshed when input fields changed.
 */
export async function updateDraft(
  ownerId: string,
  draftId: string,
  expectedRevision: number,
  edits: MealDraftEdits,
  now: Date,
): Promise<{ draft: MealDraftView; preview: DraftPreview }> {
  const row = await loadDraft(ownerId, draftId);
  if (row.revision !== expectedRevision) throw conflict(row.revision);
  const previous = mealDraftStateSchema.parse(row.state);

  const [{ restrictions }, plan] = await Promise.all([
    ownerContext(ownerId),
    getActivePlan(ownerId),
  ]);
  const merged: MealDraftState = {
    ...previous,
    text: edits.text !== undefined ? edits.text : previous.text,
    uploadIds: edits.uploadIds ?? previous.uploadIds,
    localDate: edits.localDate ?? previous.localDate,
    time: edits.time !== undefined ? edits.time : previous.time,
    planSlotId: edits.planSlotId !== undefined ? edits.planSlotId : previous.planSlotId,
    planOptionId: edits.planOptionId !== undefined ? edits.planOptionId : previous.planOptionId,
    notes: edits.notes !== undefined ? edits.notes : previous.notes,
    questions: edits.questions ?? previous.questions,
    items: edits.items ? reconcileItems(edits.items, previous.items) : previous.items,
    lastChanges: [],
  };
  if (merged.planSlotId !== previous.planSlotId) merged.planOptionId = edits.planOptionId ?? null;

  const { slot, option } = resolveLink(
    plan,
    merged.localDate,
    merged.planSlotId,
    merged.planOptionId,
  );
  const annotated = matchAndAnnotate(merged.items, plan, slot, option);
  merged.planOptionId = option ? option.id : merged.planOptionId;
  merged.items = annotated.items;
  merged.restrictionHits = computeRestrictionHits(merged.items, restrictions);

  const { count } = await prisma.mealDraft.updateMany({
    where: { id: row.id, userId: ownerId, revision: expectedRevision },
    data: {
      state: merged as Prisma.InputJsonValue,
      revision: expectedRevision + 1,
      analysisInputHash: inputHash(merged),
      expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
    },
  });
  if (count === 0) throw conflict((await loadDraft(ownerId, draftId)).revision);

  const draft = await getDraft(ownerId, draftId);
  return { draft, preview: { match: annotated.match } };
}

function planContextFor(plan: ActivePlan | null, localDate: string): MealPlanContext | null {
  if (!plan) return null;
  const slots = slotsForWeekday(plan, weekdayOf(localDate));
  if (slots.length === 0) return null;
  return {
    slots: slots.map((s) => ({
      originalName: s.originalName,
      englishLabel: s.englishLabel,
      options: s.options.map((o) => ({
        label: o.label,
        items: o.items.map((i) => ({ originalName: i.originalName, englishLabel: i.englishLabel })),
      })),
    })),
  };
}

function outputToItem(item: MealAnalysisOutput['items'][number], position: number): DraftFoodItem {
  return draftFoodItemSchema.parse({
    key: newKey(),
    position,
    originalName: item.originalName,
    englishLabel: item.englishLabel,
    quantity: item.quantity,
    unit: item.unit,
    quantityUnknown: item.quantityUnknown,
    quantityAssumed: item.quantityAssumed,
    preparation: item.preparation,
    category: item.category,
    alternatives: item.alternatives,
    nutrition: item.nutrition,
  });
}

function outputToItems(output: MealAnalysisOutput): DraftFoodItem[] {
  return output.items.map(outputToItem);
}

function outputToQuestions(output: MealAnalysisOutput, items: DraftFoodItem[]): DraftQuestion[] {
  return output.questions.map((q) => ({
    key: newKey(),
    itemKey: q.itemIndex === null ? null : (items[q.itemIndex]?.key ?? null),
    question: q.question,
    kind: q.kind,
    choices: q.choices,
    answer: null,
  }));
}

/** Map the AI's suggested slot/option names to real ids; the user's own choice always wins. */
function suggestLink(
  state: MealDraftState,
  output: MealAnalysisOutput,
  items: DraftFoodItem[],
  plan: ActivePlan | null,
): { planSlotId: string | null; planOptionId: string | null } {
  if (!plan) return { planSlotId: state.planSlotId, planOptionId: state.planOptionId };
  const daySlots = slotsForWeekday(plan, weekdayOf(state.localDate));
  let slot = state.planSlotId ? daySlots.find((s) => s.id === state.planSlotId) : undefined;
  if (!slot && !state.planSlotId && output.suggestedSlot) {
    const suggested = output.suggestedSlot;
    slot = daySlots.find((s) => sameFood(s, suggested));
  }
  if (!slot) return { planSlotId: state.planSlotId, planOptionId: state.planOptionId };
  if (state.planOptionId && slot.options.some((o) => o.id === state.planOptionId)) {
    return { planSlotId: slot.id, planOptionId: state.planOptionId };
  }
  const byIndex =
    output.suggestedOptionIndex === null
      ? undefined
      : [...slot.options].sort((a, b) => a.position - b.position)[output.suggestedOptionIndex];
  const option = byIndex ?? bestOption(items.map(toRubricItem), slot);
  return { planSlotId: slot.id, planOptionId: option?.id ?? null };
}

function isAnswered(question: DraftQuestion): boolean {
  return question.answer !== null && question.answer.trim() !== '';
}

/** The review as the model must see it in REFINE mode: each item with its answered question, plus every answer. */
function refineContextFor(state: MealDraftState): MealRefineContext {
  const answered = state.questions.filter(isAnswered);
  const answerByItem = new Map(answered.map((q) => [q.itemKey, q.answer as string]));
  return {
    items: state.items.map((item) => ({
      key: item.key,
      originalName: item.originalName,
      englishLabel: item.englishLabel,
      quantity: item.quantityUnknown ? null : item.quantity,
      unit: item.unit,
      quantityUnknown: item.quantityUnknown,
      preparation: item.preparation,
      category: item.category,
      answer: answerByItem.get(item.key) ?? null,
    })),
    answers: answered.map((q) => ({ question: q.question, answer: q.answer as string })),
  };
}

/**
 * Merge a REFINE reply onto the reviewed items by position (improvement plan
 * B1). The user's names and preparation always win; a label value they
 * entered is never replaced; the model's quantity is taken only where the
 * portion was unknown, its nutrition only where none was held or a
 * re-estimate was owed. Items the model drops stay; extra ones are appended.
 */
export function mergeRefinedItems(
  current: DraftFoodItem[],
  output: MealAnalysisOutput,
): DraftFoodItem[] {
  const merged = current.map((item, index) => {
    const fresh = output.items[index];
    if (!fresh) return item;
    const next: DraftFoodItem = { ...item };
    if (item.quantityUnknown && !fresh.quantityUnknown && fresh.quantity !== null) {
      next.quantity = fresh.quantity;
      next.unit = fresh.unit ?? item.unit;
      next.quantityUnknown = false;
      next.quantityAssumed = fresh.quantityAssumed;
    }
    const takeNutrition =
      fresh.nutrition !== null &&
      !item.nutrition?.userOverride &&
      (item.nutrition === null || item.needsReestimate);
    if (takeNutrition) {
      next.previousNutrition = item.nutrition ?? item.previousNutrition;
      next.nutrition = fresh.nutrition;
      next.needsReestimate = false;
      next.scaleFlag = 'SCALED';
    }
    if (item.alternatives.length === 0 && fresh.alternatives.length > 0) {
      next.alternatives = fresh.alternatives;
    }
    return next;
  });
  const extra = output.items
    .slice(current.length)
    .map((item, i) => ({ ...outputToItem(item, current.length + i), isAddedItem: true }));
  return [...merged, ...extra].map((item, position) => ({ ...item, position }));
}

/** Answered questions are done; the unanswered ones give way to the model's new questions. */
function mergeRefinedQuestions(
  current: DraftQuestion[],
  output: MealAnalysisOutput,
  items: DraftFoodItem[],
): DraftQuestion[] {
  const answered = current.filter(isAnswered);
  return outputToQuestions(output, items).filter(
    (q) =>
      !answered.some(
        (a) => (q.itemKey !== null && a.itemKey === q.itemKey) || a.question === q.question,
      ),
  );
}

/**
 * One MEAL_TEXT / MEAL_PHOTO operation under the 45 s deadline. The result
 * is persisted by a conditional update on `(analysisRunId, revision =
 * analysisStartedRevision)`; an edit in the meantime wins and the run ends
 * FAILED / SUPERSEDED (tech spec § 21.8). Starting a run does not bump the
 * revision, so autosaves keep working while it is in flight.
 *
 * `mode` REFINE (with reviewed items present) sends the items and the answers
 * back and merges the reply onto them (`mergeRefinedItems`); the slot link
 * stays as the user has it. Without items it is a plain ANALYZE.
 */
export async function analyzeDraft(
  ownerId: string,
  draftId: string,
  expectedRevision: number,
  now: Date,
  mode: MealAnalysisMode = 'ANALYZE',
): Promise<MealDraftView> {
  const row = await loadDraft(ownerId, draftId);
  if (row.revision !== expectedRevision) throw conflict(row.revision);
  const state = mealDraftStateSchema.parse(row.state);
  const refining = mode === 'REFINE' && state.items.length > 0;
  if (!refining && !state.text?.trim() && state.uploadIds.length === 0) {
    throw new ServiceError(t('meal.errors.nothingToAnalyze'), 'VALIDATION');
  }

  const runId = randomUUID();
  const started = await prisma.mealDraft.updateMany({
    where: { id: row.id, userId: ownerId, revision: expectedRevision },
    data: {
      analysisStatus: 'RUNNING',
      analysisRunId: runId,
      analysisStartedRevision: expectedRevision,
      analysisFailureReason: null,
    },
  });
  if (started.count === 0) throw conflict((await loadDraft(ownerId, draftId)).revision);

  const [{ zone, restrictions }, plan] = await Promise.all([
    ownerContext(ownerId),
    getActivePlan(ownerId),
  ]);
  // A refine works from the identified items and the answers: no photo round trip
  // (three S3 reads and image tokens per answered question) and no plan context,
  // since the link is pinned and the model's suggestion is discarded.
  const kind: AiKind = state.uploadIds.length > 0 && !refining ? 'MEAL_PHOTO' : 'MEAL_TEXT';
  const admission = await admitOperation(ownerId, kind, localDateFor(now, zone));
  if (!admission.ok) {
    await prisma.mealDraft.updateMany({
      where: { id: row.id, analysisRunId: runId },
      data: { analysisStatus: 'FAILED', analysisFailureReason: admission.code },
    });
    throw new ServiceError(
      admission.code === 'DAILY_AI_CAP' ? t('meal.errors.aiCap') : t('meal.errors.aiUnavailable'),
      admission.code,
    );
  }

  let result: AiResult<MealAnalysisOutput>;
  try {
    const images = kind === 'MEAL_PHOTO' ? await readStagedImages(ownerId, state.uploadIds) : [];
    result = await analyzeMeal({
      text: state.text,
      images,
      planContext: refining ? null : planContextFor(plan, state.localDate),
      refine: refining ? refineContextFor(state) : null,
      deadlineAt: now.getTime() + MEAL_ANALYSIS_DEADLINE_MS,
      userTag: sha256(ownerId).slice(0, 24),
    });
  } catch (error) {
    result = {
      ok: false,
      reason: 'PROVIDER_ERROR',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: Date.now() - now.getTime(),
    };
    logger.warn({ err: error }, 'meal analysis threw before the adapter answered');
  }
  await finishOperation(admission.callId, result, expectedRevision);

  if (!result.ok) {
    await prisma.mealDraft.updateMany({
      where: { id: row.id, analysisRunId: runId },
      data: { analysisStatus: 'FAILED', analysisFailureReason: result.reason },
    });
    throw result.reason === 'TIMEOUT'
      ? new ServiceError(t('meal.errors.aiTimeout'), 'AI_TIMEOUT')
      : new ServiceError(t('meal.errors.analysisFailed'), 'AI_UNAVAILABLE');
  }

  const items = refining ? mergeRefinedItems(state.items, result.data) : outputToItems(result.data);
  const link = refining
    ? { planSlotId: state.planSlotId, planOptionId: state.planOptionId }
    : suggestLink(state, result.data, items, plan);
  const { slot, option } = resolveLink(plan, state.localDate, link.planSlotId, link.planOptionId);
  const annotated = matchAndAnnotate(items, plan, slot, option);
  const next: MealDraftState = {
    ...state,
    planSlotId: link.planSlotId,
    planOptionId: link.planOptionId,
    items: annotated.items,
    questions: refining
      ? mergeRefinedQuestions(state.questions, result.data, annotated.items)
      : outputToQuestions(result.data, annotated.items),
    restrictionHits: computeRestrictionHits(annotated.items, restrictions),
    lastChanges: refining ? result.data.changes : [],
  };

  const persisted = await prisma.mealDraft.updateMany({
    where: { id: row.id, analysisRunId: runId, revision: expectedRevision },
    data: {
      state: next as Prisma.InputJsonValue,
      analysisResult: result.data as Prisma.InputJsonValue,
      analysisStatus: 'DONE',
      analysisFailureReason: null,
      revision: expectedRevision + 1,
      expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
    },
  });
  if (persisted.count === 0) {
    // The user edited meanwhile: their values stay. Only this run is marked; a newer run keeps going.
    await prisma.mealDraft.updateMany({
      where: { id: row.id, analysisRunId: runId, analysisStatus: 'RUNNING' },
      data: { analysisStatus: 'FAILED', analysisFailureReason: 'SUPERSEDED' },
    });
  }
  return getDraft(ownerId, draftId);
}

/** "Start over": the owner's draft and its staged photos go; a draft already gone is fine. */
export async function discardDraft(ownerId: string, draftId: string): Promise<void> {
  const row = await prisma.mealDraft.findFirst({ where: { id: draftId, userId: ownerId } });
  if (!row) return;
  const parsed = mealDraftStateSchema.safeParse(row.state);
  for (const uploadId of parsed.success ? parsed.data.uploadIds : []) {
    try {
      await deleteStagedUpload(ownerId, uploadId);
    } catch (error) {
      if (!(error instanceof ServiceError && error.code === 'NOT_FOUND')) throw error;
    }
  }
  await prisma.mealDraft.deleteMany({ where: { id: row.id, userId: ownerId } });
}

/** Cleanup task: drafts past `expiresAt` go, and the caller removes their staged uploads. */
export async function expireDrafts(now: Date): Promise<{ deleted: number; uploadIds: string[] }> {
  const rows = await prisma.mealDraft.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, state: true },
  });
  if (rows.length === 0) return { deleted: 0, uploadIds: [] };
  const uploadIds = rows.flatMap((row) => {
    const parsed = mealDraftStateSchema.safeParse(row.state);
    return parsed.success ? parsed.data.uploadIds : [];
  });
  const { count } = await prisma.mealDraft.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  return { deleted: count, uploadIds };
}

// ─── Confirmed meals ───────────────────────────────────────────────────────

const recentCache = new Map<string, { at: number; data: RecentMeal[] }>();

function invalidateRecent(ownerId: string): void {
  recentCache.delete(ownerId);
}

/** Tests only. */
export function resetRecentMealsCache(): void {
  recentCache.clear();
}

/**
 * The option rule (product spec § 7, B3; `optionRequiredFor`): "I ate this"
 * (a PLANNED draft) always needs the option; any other path only when what
 * was eaten overlaps an option, a meal that overlaps nothing being a
 * different food under the slot.
 */
function requireOption(
  slot: RubricSlot | null,
  option: RubricOption | null,
  planOptionId: string | null,
  items: RubricFoodItem[],
  kind: MealDraftState['kind'] | null,
) {
  if (!slot) return;
  if (planOptionId && !option) throw notFound(t('meal.errors.optionNotInSlot'));
  if (!option && optionRequiredFor(items, slot, kind === 'PLANNED')) {
    throw new ServiceError(t('meal.errors.optionRequired'), 'OPTION_REQUIRED');
  }
}

/**
 * The confirmation boundary (product spec § 7). Retry-safe: a meal with the
 * same `clientRequestId` is returned even when the draft is already gone;
 * a concurrent duplicate insert is caught and the winner's meal returned.
 * One transaction: upsert the DayRecord, unskip the slot (recorded wins),
 * insert the meal and its items, attach the uploads, delete the draft.
 */
export async function saveMeal(
  ownerId: string,
  draftId: string,
  expectedRevision: number,
  clientRequestId: string,
  now: Date,
): Promise<SaveMealResult> {
  const already = await findMealByClientRequestId(ownerId, clientRequestId);
  if (already) return { ...already, droppedPhotos: 0 };

  const row = await prisma.mealDraft.findFirst({ where: { id: draftId, userId: ownerId } });
  if (!row) {
    const late = await findMealByClientRequestId(ownerId, clientRequestId);
    if (late) return { ...late, droppedPhotos: 0 };
    throw notFound(t('meal.errors.draftNotFound'));
  }
  if (row.revision !== expectedRevision) throw conflict(row.revision);
  const state = mealDraftStateSchema.parse(row.state);

  const [{ zone }, plan] = await Promise.all([ownerContext(ownerId), getActivePlan(ownerId)]);
  if (isFutureLocalDateTime(state.localDate, state.time, now, zone)) {
    throw new ServiceError(t('meal.errors.futureTime'), 'FUTURE_TIME');
  }
  if (state.planSlotId) {
    const applies =
      plan &&
      slotsForWeekday(plan, weekdayOf(state.localDate)).some((s) => s.id === state.planSlotId);
    if (!applies) throw notFound(t('meal.errors.slotNotOnDay'));
  }
  const { slot, option } = resolveLink(plan, state.localDate, state.planSlotId, state.planOptionId);
  requireOption(slot, option, state.planOptionId, state.items.map(toRubricItem), state.kind);
  const { items } = matchAndAnnotate(state.items, plan, slot, option);

  // A photo staged over 24 h ago may already be gone (cleanup ran before the
  // draft expired). The meal still saves — the food record matters more than
  // the picture — and the count goes back so the user is told, not left to notice.
  const stillStaged =
    state.uploadIds.length === 0
      ? []
      : await prisma.upload.findMany({
          where: { id: { in: state.uploadIds }, userId: ownerId, status: 'STAGED' },
          select: { id: true },
        });
  const uploadIds = state.uploadIds.filter((id) => stillStaged.some((u) => u.id === id));
  const droppedPhotos = state.uploadIds.length - uploadIds.length;

  let mealId: string;
  try {
    mealId = await prisma.$transaction(async (tx) => {
      const day = await tx.dayRecord.upsert({
        where: { userId_localDate: { userId: ownerId, localDate: state.localDate } },
        create: { userId: ownerId, localDate: state.localDate, timeZone: zone },
        update: {},
      });
      if (slot) {
        await tx.daySkippedSlot.deleteMany({ where: { dayRecordId: day.id, planSlotId: slot.id } });
      }
      const meal = await tx.meal.create({
        data: {
          userId: ownerId,
          dayRecordId: day.id,
          consumedLocalTime: state.time,
          inputKind: state.kind,
          originalText: state.text,
          notes: state.notes,
          copiedFromMealId: state.copiedFromMealId,
          clientRequestId: row.clientRequestId,
          planSlotId: slot?.id ?? null,
          planOptionId: option?.id ?? null,
          linkConfirmedByUser: slot !== null,
        },
      });
      if (items.length > 0) {
        await tx.foodItem.createMany({
          data: toFoodItemRows(meal.id, items, state.restrictionHits),
        });
      }
      for (const [position, uploadId] of uploadIds.entries()) {
        await tx.upload.updateMany({
          where: { id: uploadId, userId: ownerId, status: 'STAGED' },
          data: { status: 'ATTACHED', mealId: meal.id, position, expiresAt: null },
        });
      }
      await tx.mealDraft.deleteMany({ where: { id: row.id } });
      return meal.id;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await findMealByClientRequestId(ownerId, row.clientRequestId);
    if (winner) return { ...winner, droppedPhotos: 0 };
    throw error;
  }

  invalidateRecent(ownerId);
  await markStaleIfNeeded(ownerId, state.localDate);
  return { ...(await getMeal(ownerId, mealId)), droppedPhotos };
}

/**
 * Edit a confirmed meal in place (MealReview "edit" mode). Items are replaced
 * and rescaled like a draft's; a date change moves the meal to another
 * DayRecord and drops a slot link that does not apply on the new weekday.
 */
export async function updateMeal(
  ownerId: string,
  mealId: string,
  expectedRevision: number,
  edits: {
    time?: string | null;
    localDate?: string;
    notes?: string | null;
    items?: DraftFoodItem[];
  },
  now: Date,
): Promise<MealView> {
  const meal = await loadMeal(ownerId, mealId);
  if (meal.revision !== expectedRevision) throw conflict(meal.revision);

  const [{ zone, restrictions }, plan] = await Promise.all([
    ownerContext(ownerId),
    getActivePlan(ownerId),
  ]);
  const localDate = edits.localDate ?? meal.day.localDate;
  const time = edits.time !== undefined ? edits.time : meal.consumedLocalTime;
  if (isFutureLocalDateTime(localDate, time, now, zone)) {
    throw new ServiceError(t('meal.errors.futureTime'), 'FUTURE_TIME');
  }
  const moved = localDate !== meal.day.localDate;
  let planSlotId = meal.planSlotId;
  let planOptionId = meal.planOptionId;
  if (moved && planSlotId && plan) {
    const applies = slotsForWeekday(plan, weekdayOf(localDate)).some((s) => s.id === planSlotId);
    if (!applies) {
      planSlotId = null;
      planOptionId = null;
    }
  }
  const { slot, option } = resolveLink(plan, localDate, planSlotId, planOptionId);

  let items: DraftFoodItem[] | null = null;
  let hits: MealDraftState['restrictionHits'] = [];
  if (edits.items) {
    const reconciled = reconcileItems(edits.items, meal.items.map(rowToDraftItem));
    items = matchAndAnnotate(reconciled, plan, slot, option).items;
    hits = computeRestrictionHits(items, restrictions);
  }

  await prisma.$transaction(async (tx) => {
    let dayRecordId = meal.dayRecordId;
    if (moved) {
      const day = await tx.dayRecord.upsert({
        where: { userId_localDate: { userId: ownerId, localDate } },
        create: { userId: ownerId, localDate, timeZone: zone },
        update: {},
      });
      dayRecordId = day.id;
    }
    if (slot) {
      await tx.daySkippedSlot.deleteMany({ where: { dayRecordId, planSlotId: slot.id } });
    }
    const { count } = await tx.meal.updateMany({
      where: { id: meal.id, userId: ownerId, revision: expectedRevision },
      data: {
        dayRecordId,
        consumedLocalTime: time,
        notes: edits.notes !== undefined ? edits.notes : meal.notes,
        planSlotId,
        planOptionId,
        revision: expectedRevision + 1,
      },
    });
    if (count === 0) throw conflict(expectedRevision + 1);
    if (items) {
      await tx.foodItem.deleteMany({ where: { mealId: meal.id } });
      if (items.length > 0)
        await tx.foodItem.createMany({ data: toFoodItemRows(meal.id, items, hits) });
    }
  });

  invalidateRecent(ownerId);
  await markStaleIfNeeded(ownerId, meal.day.localDate);
  if (moved) await markStaleIfNeeded(ownerId, localDate);
  return getMeal(ownerId, mealId);
}

export async function deleteMeal(
  ownerId: string,
  mealId: string,
  expectedRevision: number,
): Promise<void> {
  const meal = await loadMeal(ownerId, mealId);
  if (meal.revision !== expectedRevision) throw conflict(meal.revision);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.meal.deleteMany({
      where: { id: meal.id, userId: ownerId, revision: expectedRevision },
    });
    if (count === 0) throw conflict(expectedRevision + 1);
    await tx.upload.updateMany({
      where: { userId: ownerId, mealId: meal.id },
      data: { status: 'REMOVED', mealId: null },
    });
  });
  // The rows are REMOVED either way; a failed object delete only leaves an orphan for the purge.
  await deleteObjects(meal.uploads.map((u) => u.storageKey));
  invalidateRecent(ownerId);
  await markStaleIfNeeded(ownerId, meal.day.localDate);
}

/**
 * Change the plan link: the slot must apply on the meal's weekday and the
 * option belong to it; a single-option slot resolves by itself. Linking to a
 * slot the day had marked skipped unskips it (recorded wins).
 */
export async function setMealLink(
  ownerId: string,
  mealId: string,
  expectedRevision: number,
  planSlotId: string | null,
  planOptionId: string | null,
): Promise<MealView> {
  const meal = await loadMeal(ownerId, mealId);
  if (meal.revision !== expectedRevision) throw conflict(meal.revision);
  const plan = await getActivePlan(ownerId);
  if (planSlotId) {
    const applies =
      plan && slotsForWeekday(plan, weekdayOf(meal.day.localDate)).some((s) => s.id === planSlotId);
    if (!applies) throw notFound(t('meal.errors.slotNotOnDay'));
  }
  const { slot, option } = resolveLink(plan, meal.day.localDate, planSlotId, planOptionId);
  requireOption(slot, option, planOptionId, meal.items.map(toRubricFoodItem), null);

  await prisma.$transaction(async (tx) => {
    if (slot) {
      await tx.daySkippedSlot.deleteMany({
        where: { dayRecordId: meal.dayRecordId, planSlotId: slot.id },
      });
    }
    const { count } = await tx.meal.updateMany({
      where: { id: meal.id, userId: ownerId, revision: expectedRevision },
      data: {
        planSlotId: slot?.id ?? null,
        planOptionId: option?.id ?? null,
        linkConfirmedByUser: true,
        revision: expectedRevision + 1,
      },
    });
    if (count === 0) throw conflict(expectedRevision + 1);
  });

  invalidateRecent(ownerId);
  await markStaleIfNeeded(ownerId, meal.day.localDate);
  return getMeal(ownerId, mealId);
}

/** "Reuse as new meal": a RECENT draft copying the source's items; the source is never modified. */
export async function reuseMeal(
  ownerId: string,
  mealId: string,
  clientRequestId: string,
  localDate: string,
  now: Date,
): Promise<CreateDraftResult> {
  const source = await loadMeal(ownerId, mealId);
  const { zone } = await ownerContext(ownerId);
  const sameWeekday = weekdayOf(localDate) === weekdayOf(source.day.localDate);
  return createDraft(
    ownerId,
    {
      clientRequestId,
      kind: 'RECENT',
      text: null,
      uploadIds: [],
      localDate,
      time: localDate === localDateFor(now, zone) ? localTimeFor(now, zone) : null,
      planSlotId: sameWeekday ? source.planSlotId : null,
      planOptionId: sameWeekday ? source.planOptionId : null,
      copiedFromMealId: source.id,
    },
    now,
  );
}

/** Composer "Recent" row: distinct by item names, newest first, cached 60 s per user. */
export async function listRecentMeals(ownerId: string, limit = 8): Promise<RecentMeal[]> {
  const cached = recentCache.get(ownerId);
  if (cached && Date.now() - cached.at < RECENT_MEALS_CACHE_MS && cached.data.length >= limit) {
    return cached.data.slice(0, limit);
  }
  const rows = await prisma.meal.findMany({
    where: { userId: ownerId },
    orderBy: { createdAt: 'desc' },
    take: limit * 4,
    include: { items: { orderBy: { position: 'asc' } }, day: { select: { localDate: true } } },
  });
  const seen = new Set<string>();
  const data: RecentMeal[] = [];
  for (const row of rows) {
    if (row.items.length === 0) continue;
    const signature = row.items
      .map((i) => i.englishLabel.trim().toLowerCase())
      .sort()
      .join('|');
    if (seen.has(signature)) continue;
    seen.add(signature);
    let energy: number | null = 0;
    for (const item of row.items) {
      const v = parseNutrition(item.nutrition)?.values.ENERGY_KCAL ?? null;
      if (v === null || energy === null) {
        energy = null;
      } else {
        energy += v;
      }
    }
    data.push({
      id: row.id,
      localDate: row.day.localDate,
      consumedLocalTime: row.consumedLocalTime,
      planSlotId: row.planSlotId,
      planOptionId: row.planOptionId,
      items: row.items.map((i) => ({ originalName: i.originalName, englishLabel: i.englishLabel })),
      energyKcal: energy === null ? null : Math.round(energy),
    });
    if (data.length >= limit) break;
  }
  recentCache.set(ownerId, { at: Date.now(), data });
  return data;
}

export async function getMeal(ownerId: string, mealId: string): Promise<MealView> {
  return toMealView(await loadMeal(ownerId, mealId));
}

/** The option the user chose the last time they logged this slot ("Last time"). */
export async function lastUsedOptionId(
  ownerId: string,
  planSlotId: string,
): Promise<string | null> {
  const row = await prisma.meal.findFirst({
    where: { userId: ownerId, planSlotId, planOptionId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { planOptionId: true },
  });
  return row?.planOptionId ?? null;
}

export async function listMealsForDate(ownerId: string, localDate: string): Promise<MealView[]> {
  const rows = await prisma.meal.findMany({
    where: { userId: ownerId, day: { localDate } },
    orderBy: [{ consumedLocalTime: 'asc' }, { createdAt: 'asc' }],
    include: MEAL_INCLUDE,
  });
  return rows.map(toMealView);
}
