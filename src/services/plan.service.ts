import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PlanItem, type PlanOption, type PlanSlot } from '@prisma/client';
import { ServiceError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { RubricPlanItem, RubricSlot, RubricTarget } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { NUTRIENT_KEYS, type NutrientKey, nutritionSchema } from '@/lib/validations/nutrition';
import {
  DRAFT_SECTION_PAYLOADS,
  EVERY_DAY,
  PLAN_TEXT_MAX,
  alternativeSchema,
  planDraftSchema,
  targetScopeKey,
  type DraftItem,
  type DraftSection,
  type DraftSlot,
  type DraftTarget,
  type PlanDraft,
} from '@/lib/validations/plan';
import { estimatePlanBaseline } from '@/services/ai/interpret-plan';
import type { BaselineItemInput } from '@/services/ai/types';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import { DEFAULT_WEEK_START } from '@/services/profile.service';
import { markStaleIfNeeded } from '@/services/reflection.service';

/**
 * Plan module (tech spec § 5 "Plan", § 7 "Plan", decision 017): one plan per
 * user. The active plan is the slot/option/item/target/note rows; a
 * pending import, a manual setup or an edit lives in `Plan.draftJson` until
 * `confirmPlan` applies it in one transaction. Every function takes the
 * owner id first and scopes its root query by it.
 */

export const BASELINE_DEADLINE_MS = 60_000;

// ─── Read model ───────────────────────────────────────────────────────────

export type DraftState = 'PENDING' | 'READY' | 'FAILED';

export interface ActivePlan {
  id: string;
  status: 'NONE' | 'DRAFT_PENDING' | 'ACTIVE';
  structure: 'SAME_EVERY_DAY' | 'BY_WEEKDAY' | 'TARGETS_ONLY' | null;
  name: string | null;
  sourceNote: string | null;
  confirmedAt: Date | null;
  /** When the row was first created (the user's first draft); it survives edits, replacements and deletion. */
  createdAt: Date;
  /** Every slot of the plan, any weekday, with options and items (numbers, not Decimals). */
  slots: RubricSlot[];
  targets: Array<RubricTarget & { id: string; weekday: number | null }>;
  /** Plan instructions kept verbatim, never evaluated (decision 023). */
  notes: Array<{ id: string; originalText: string; reason: string }>;
  /** Pending draft, if any. */
  draft: { kind: 'IMPORT' | 'MANUAL' | 'EDIT'; state: DraftState } | null;
}

/** `getPlan`: the active plan plus everything the review and My plan screens need. */
export interface PlanView extends ActivePlan {
  sourceLanguage: string | null;
  sourceText: string | null;
  /** The parsed draft when one is ready (import finished, manual or edit in progress). */
  draftJson: PlanDraft | null;
  /** The failed import's category, when `draft.state === 'FAILED'`. */
  draftError: string | null;
}

export interface ImportStatus {
  state: DraftState | 'NONE';
  errorCategory: string | null;
}

type PlanWithRows = Prisma.PlanGetPayload<{
  include: {
    slots: { include: { options: { include: { items: true } } } };
    targets: true;
    notes: true;
  };
}>;

const planInclude = {
  slots: {
    orderBy: [{ weekday: 'asc' }, { position: 'asc' }],
    include: {
      options: {
        orderBy: { position: 'asc' },
        include: { items: { orderBy: { position: 'asc' } } },
      },
    },
  },
  targets: true,
  notes: true,
} satisfies Prisma.PlanInclude;

const alternativesSchema = alternativeSchema.array();

function parseNutrition(value: unknown): DraftItem['nutrition'] {
  const parsed = nutritionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseAlternatives(value: unknown): DraftItem['alternatives'] {
  const parsed = alternativesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function toRubricItem(row: PlanItem): RubricPlanItem {
  return {
    id: row.id,
    originalName: row.originalName,
    englishLabel: row.englishLabel,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    quantityAssumed: row.quantityAssumed,
    category: row.category,
    alternatives: parseAlternatives(row.alternatives),
    nutrition: parseNutrition(row.nutrition),
  };
}

function toRubricSlot(
  row: PlanSlot & { options: Array<PlanOption & { items: PlanItem[] }> },
): RubricSlot {
  return {
    id: row.id,
    weekday: row.weekday,
    position: row.position,
    originalName: row.originalName,
    englishLabel: row.englishLabel,
    timeStart: row.timeStart,
    timeEnd: row.timeEnd,
    options: row.options.map((o) => ({
      id: o.id,
      position: o.position,
      label: o.label,
      items: o.items.map(toRubricItem),
    })),
  };
}

function toPlanView(plan: PlanWithRows, draft: ActivePlan['draft'], error: string | null) {
  const draftJson = draft?.state === 'READY' ? parseDraft(plan.draftJson) : null;
  const view: PlanView = {
    id: plan.id,
    status: plan.status,
    structure: plan.structure,
    name: plan.name,
    sourceNote: plan.sourceNote,
    sourceLanguage: plan.sourceLanguage,
    sourceText: plan.sourceText,
    confirmedAt: plan.confirmedAt,
    createdAt: plan.createdAt,
    slots: plan.slots.map(toRubricSlot),
    targets: plan.targets.map((row) => ({
      id: row.id,
      planSlotId: row.planSlotId,
      weekday: row.weekday,
      nutrient: row.nutrient,
      type: row.type,
      low: row.low === null ? null : Number(row.low),
      high: row.high === null ? null : Number(row.high),
      source: row.source,
    })),
    notes: plan.notes.map((row) => ({
      id: row.id,
      originalText: row.originalText,
      reason: row.reason,
    })),
    draft,
    draftJson,
    draftError: error,
  };
  return view;
}

function parseDraft(value: unknown): PlanDraft | null {
  if (value === null || value === undefined) return null;
  const parsed = planDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** PENDING while the import job is queued/running, READY once `draftJson` exists, else FAILED. */
async function draftStateFor(
  plan: Pick<PlanWithRows, 'userId' | 'draftKind' | 'draftId' | 'draftJson'>,
): Promise<{ draft: ActivePlan['draft']; error: string | null }> {
  if (!plan.draftKind) return { draft: null, error: null };
  if (plan.draftJson !== null)
    return { draft: { kind: plan.draftKind, state: 'READY' }, error: null };
  if (plan.draftKind !== 'IMPORT' || !plan.draftId)
    return { draft: { kind: plan.draftKind, state: 'FAILED' }, error: null };
  const job = await prisma.planImportJob.findFirst({
    where: { userId: plan.userId, draftId: plan.draftId },
    orderBy: { createdAt: 'desc' },
    select: { status: true, errorCategory: true },
  });
  if (job && (job.status === 'QUEUED' || job.status === 'RUNNING'))
    return { draft: { kind: 'IMPORT', state: 'PENDING' }, error: null };
  return { draft: { kind: 'IMPORT', state: 'FAILED' }, error: job?.errorCategory ?? null };
}

async function findPlanWithRows(ownerId: string): Promise<PlanWithRows | null> {
  return prisma.plan.findUnique({ where: { userId: ownerId }, include: planInclude });
}

/** The active plan and draft state, or null when there is no plan row or `status = NONE`. */
export async function getPlan(ownerId: string): Promise<PlanView | null> {
  const plan = await findPlanWithRows(ownerId);
  if (!plan || plan.status === 'NONE') return null;
  const { draft, error } = await draftStateFor(plan);
  return toPlanView(plan, draft, error);
}

/** The active plan (rows), or null when `status = NONE` and no rows exist. */
export async function getActivePlan(ownerId: string): Promise<ActivePlan | null> {
  return getPlan(ownerId);
}

/** Slots that apply on a weekday (0–6): same-every-day slots (7) or that weekday's, in plan order. */
export function slotsForWeekday(plan: Pick<ActivePlan, 'slots'>, weekday: number): RubricSlot[] {
  return plan.slots
    .filter((s) => s.weekday === EVERY_DAY || s.weekday === weekday)
    .sort((a, b) => a.position - b.position);
}

// ─── Draft lifecycle ──────────────────────────────────────────────────────

async function requirePlanRow(ownerId: string) {
  const plan = await prisma.plan.findUnique({ where: { userId: ownerId } });
  if (!plan) throw new ServiceError(t('plan.errors.noPlan'), 'NOT_FOUND');
  return plan;
}

async function requireDraft(ownerId: string, draftRevision: number) {
  const plan = await requirePlanRow(ownerId);
  const draft = parseDraft(plan.draftJson);
  if (!draft || !plan.draftKind) throw new ServiceError(t('plan.errors.noDraft'), 'NOT_FOUND');
  if (draft.draftRevision !== draftRevision)
    throw new ServiceError(t('errors.conflict'), 'CONFLICT');
  return { plan, draft, kind: plan.draftKind };
}

async function cancelQueuedJobs(ownerId: string, now: Date, statuses: Array<'QUEUED' | 'RUNNING'>) {
  await prisma.planImportJob.updateMany({
    where: { userId: ownerId, status: { in: statuses } },
    data: { status: 'CANCELLED', finishedAt: now },
  });
}

/**
 * Stores the text on `draftSourceText` (the confirmed `sourceText` is untouched
 * until confirm), regenerates `draftId` and queues a job carrying it. Older
 * queued jobs of the user are cancelled.
 */
export async function startImport(
  ownerId: string,
  sourceText: string,
  now = new Date(),
): Promise<{ jobId: string; draftId: string }> {
  if (sourceText.length > PLAN_TEXT_MAX)
    throw new ServiceError(t('plan.errors.textTooLong'), 'PLAN_TEXT_TOO_LONG');
  const draftId = randomUUID();
  const draftFields = {
    status: 'DRAFT_PENDING' as const,
    draftKind: 'IMPORT' as const,
    draftId,
    draftSourceText: sourceText,
    draftJson: Prisma.DbNull,
  };
  await cancelQueuedJobs(ownerId, now, ['QUEUED']);
  await prisma.plan.upsert({
    where: { userId: ownerId },
    create: { userId: ownerId, ...draftFields },
    update: draftFields,
  });
  const job = await prisma.planImportJob.create({
    data: { userId: ownerId, draftId, status: 'QUEUED' },
    select: { id: true },
  });
  return { jobId: job.id, draftId };
}

export async function getImportStatus(ownerId: string): Promise<ImportStatus> {
  const plan = await prisma.plan.findUnique({
    where: { userId: ownerId },
    select: { userId: true, draftKind: true, draftId: true, draftJson: true },
  });
  if (!plan || plan.draftKind !== 'IMPORT') return { state: 'NONE', errorCategory: null };
  const { draft, error } = await draftStateFor(plan);
  return { state: draft?.state ?? 'NONE', errorCategory: error };
}

/** Queues the pending import's text again (a fresh `draftId`, a new job). */
export async function retryImport(
  ownerId: string,
  now = new Date(),
): Promise<{ jobId: string; draftId: string }> {
  const plan = await requirePlanRow(ownerId);
  if (plan.draftKind !== 'IMPORT' || !plan.draftSourceText)
    throw new ServiceError(t('plan.errors.noDraft'), 'NOT_FOUND');
  return startImport(ownerId, plan.draftSourceText, now);
}

/** Drops the draft. With no confirmed rows the plan goes back to `NONE`. */
export async function discardDraft(ownerId: string, now = new Date()): Promise<void> {
  const plan = await requirePlanRow(ownerId);
  await cancelQueuedJobs(ownerId, now, ['QUEUED', 'RUNNING']);
  await prisma.plan.update({
    where: { userId: ownerId },
    data: {
      status: plan.confirmedAt ? 'ACTIVE' : 'NONE',
      draftKind: null,
      draftId: null,
      draftJson: Prisma.DbNull,
      draftSourceText: null,
    },
  });
}

/** Cancels the pending import (queued or running) and discards its draft. */
export async function cancelImport(ownerId: string, now = new Date()): Promise<void> {
  await discardDraft(ownerId, now);
}

/** An empty draft for the manual wizard; the slots are added section by section. */
export async function startManual(
  ownerId: string,
  structure: PlanDraft['structure'],
  name: string | null,
  now = new Date(),
): Promise<PlanDraft> {
  const draft = planDraftSchema.parse({ structure, name, draftRevision: 0 });
  await cancelQueuedJobs(ownerId, now, ['QUEUED', 'RUNNING']);
  const draftFields = {
    status: 'DRAFT_PENDING' as const,
    draftKind: 'MANUAL' as const,
    draftId: randomUUID(),
    draftSourceText: null,
    draftJson: draft as Prisma.InputJsonValue,
  };
  await prisma.plan.upsert({
    where: { userId: ownerId },
    create: { userId: ownerId, ...draftFields },
    update: draftFields,
  });
  return draft;
}

/** Copies the active rows into a draft, keeping every row id so confirm updates in place. */
export function draftFromRows(plan: PlanWithRows): PlanDraft {
  const slots: DraftSlot[] = plan.slots.map((slot) => ({
    key: slot.id,
    id: slot.id,
    weekday: slot.weekday,
    position: slot.position,
    originalName: slot.originalName,
    englishLabel: slot.englishLabel,
    timeStart: slot.timeStart,
    timeEnd: slot.timeEnd,
    sourceExcerpt: slot.sourceExcerpt,
    reviewed: true,
    options: slot.options.map((option) => ({
      key: option.id,
      id: option.id,
      position: option.position,
      label: option.label,
      items: option.items.map((item) => ({
        key: item.id,
        id: item.id,
        position: item.position,
        originalName: item.originalName,
        englishLabel: item.englishLabel,
        quantity: item.quantity === null ? null : Number(item.quantity),
        unit: item.unit,
        quantityAssumed: item.quantityAssumed,
        assumedDefaultKey: item.assumedDefaultKey,
        preparationNote: item.preparationNote,
        alternatives: parseAlternatives(item.alternatives),
        category: item.category,
        nutrition: parseNutrition(item.nutrition),
        sourceExcerpt: item.sourceExcerpt,
        needsEstimate: false,
      })),
    })),
  }));
  const targets: DraftTarget[] = plan.targets.map((row) => ({
    key: row.id,
    slotKey: row.planSlotId,
    weekday: row.weekday,
    nutrient: row.nutrient,
    type: row.type,
    low: row.low === null ? null : Number(row.low),
    high: row.high === null ? null : Number(row.high),
    source: row.source,
    sourceExcerpt: row.sourceExcerpt,
  }));
  const notes = plan.notes.map((row) => ({
    key: row.id,
    originalText: row.originalText,
    reason: row.reason,
  }));
  return planDraftSchema.parse({
    draftRevision: 0,
    structure: plan.structure ?? 'SAME_EVERY_DAY',
    name: plan.name,
    sourceNote: plan.sourceNote,
    sourceLanguage: plan.sourceLanguage,
    slots,
    targets,
    notes,
    questions: [],
    reviewed: { meals: true, targets: true, notes: true },
    manualStep: null,
  });
}

/** Active rows → `draftJson` with their ids (`draftKind = EDIT`). */
export async function startEdit(ownerId: string, now = new Date()): Promise<PlanDraft> {
  const plan = await findPlanWithRows(ownerId);
  if (!plan || !plan.confirmedAt) throw new ServiceError(t('plan.errors.noPlan'), 'NOT_FOUND');
  const draft = draftFromRows(plan);
  await cancelQueuedJobs(ownerId, now, ['QUEUED', 'RUNNING']);
  await prisma.plan.update({
    where: { userId: ownerId },
    data: {
      status: 'DRAFT_PENDING',
      draftKind: 'EDIT',
      draftId: randomUUID(),
      draftSourceText: null,
      draftJson: draft as Prisma.InputJsonValue,
    },
  });
  return draft;
}

function itemIdentity(item: DraftItem): string {
  return [item.originalName, item.englishLabel, item.quantity, item.unit, item.preparationNote]
    .map((v) => String(v ?? ''))
    .join(' ');
}

/** Items whose name, quantity, unit or preparation changed since the previous draft need a new estimate. */
function flagChangedItems(previous: DraftSlot[], next: DraftSlot[]): DraftSlot[] {
  const before = new Map<string, DraftItem>();
  for (const slot of previous)
    for (const option of slot.options) for (const item of option.items) before.set(item.key, item);
  return next.map((slot) => ({
    ...slot,
    options: slot.options.map((option) => ({
      ...option,
      items: option.items.map((item) => {
        const old = before.get(item.key);
        const changed = !old || itemIdentity(old) !== itemIdentity(item);
        return changed && item.nutrition !== null && !item.nutrition.userOverride
          ? { ...item, needsEstimate: true }
          : item;
      }),
    })),
  }));
}

/**
 * Applies one section of `updatePlanDraftAction` to the draft. Optimistic on
 * `draftRevision`; the stored revision advances by one on every write.
 */
export async function updateDraft(
  ownerId: string,
  section: DraftSection,
  payload: unknown,
  draftRevision: number,
): Promise<PlanDraft> {
  const { plan, draft } = await requireDraft(ownerId, draftRevision);
  const parsed = DRAFT_SECTION_PAYLOADS[section].safeParse(payload);
  if (!parsed.success) throw new ServiceError(t('validation.invalid'), 'INVALID_PAYLOAD');
  let next: PlanDraft = { ...draft };
  switch (section) {
    case 'meta': {
      // Only the keys the client sent change; zod defaults never reset the others.
      const sent = new Set(Object.keys((payload ?? {}) as object));
      const meta = Object.fromEntries(
        Object.entries(parsed.data as Partial<PlanDraft>).filter(([k]) => sent.has(k)),
      );
      next = { ...next, ...meta };
      break;
    }
    case 'slots':
      next.slots = flagChangedItems(draft.slots, parsed.data as DraftSlot[]);
      next.targets = recomputeDerivedTargets(next);
      break;
    case 'slot': {
      const slot = parsed.data as DraftSlot;
      const index = draft.slots.findIndex((s) => s.key === slot.key);
      const slots = [...draft.slots];
      if (index === -1) slots.push(slot);
      else slots[index] = slot;
      next.slots = flagChangedItems(draft.slots, slots);
      next.targets = recomputeDerivedTargets(next);
      break;
    }
    case 'targets':
      next.targets = parsed.data as DraftTarget[];
      break;
    case 'notes':
      next.notes = parsed.data as PlanDraft['notes'];
      break;
    case 'questions':
      next.questions = parsed.data as PlanDraft['questions'];
      break;
    case 'reviewed':
      next.reviewed = { ...draft.reviewed, ...(parsed.data as Partial<PlanDraft['reviewed']>) };
      break;
    case 'manualStep':
      next.manualStep = parsed.data as string | null;
      break;
  }
  return writeDraft(ownerId, plan.draftId, next, draftRevision);
}

/**
 * Conditional write, as meals do with `revision`: the row must still hold the
 * draft and revision that were read, so two edits from the same revision
 * cannot both succeed and silently overwrite each other. The draft lives in
 * `draftJson`, hence the JSON path filter.
 */
async function writeDraft(
  ownerId: string,
  draftId: string | null,
  draft: PlanDraft,
  fromRevision: number,
) {
  const next = { ...draft, draftRevision: fromRevision + 1 };
  const { count } = await prisma.plan.updateMany({
    where: {
      userId: ownerId,
      draftId,
      draftJson: { path: ['draftRevision'], equals: fromRevision },
    },
    data: { draftJson: next as Prisma.InputJsonValue },
  });
  if (count === 0) throw new ServiceError(t('errors.conflict'), 'CONFLICT');
  return next;
}

// ─── Baseline (tech spec § 5.1) ───────────────────────────────────────────

function firstOptionItems(slot: DraftSlot): DraftItem[] {
  return slot.options[0]?.items ?? [];
}

function scopeOf(target: Pick<DraftTarget, 'weekday' | 'slotKey' | 'nutrient'>) {
  return targetScopeKey(target.weekday, target.slotKey, target.nutrient);
}

/**
 * Regenerates the derived daily targets while keeping every EXPLICIT one:
 * ESTIMATED = the sum over the first option of each slot per nutrient (never
 * where an explicit daily figure exists); SUM_OF_MEALS energy = the sum of
 * the explicit per-meal ranges, only when every slot has one and no daily
 * figure was given. Weekday plans get one set per weekday.
 */
export function recomputeDerivedTargets(draft: Pick<PlanDraft, 'structure' | 'slots' | 'targets'>) {
  const explicit = draft.targets.filter((target) => target.source === 'EXPLICIT');
  const explicitDaily = new Set(explicit.filter((target) => target.slotKey === null).map(scopeOf));
  const explicitAllDays = new Set(
    explicit
      .filter((target) => target.slotKey === null && target.weekday === null)
      .map((target) => target.nutrient),
  );
  const hasExplicitDaily = (weekday: number | null, nutrient: NutrientKey) =>
    explicitAllDays.has(nutrient) ||
    explicitDaily.has(targetScopeKey(weekday, null, nutrient)) ||
    (weekday !== null && explicitDaily.has(targetScopeKey(EVERY_DAY, null, nutrient)));

  const byWeekday = new Map<number | null, DraftSlot[]>();
  for (const slot of draft.slots) {
    const weekday = draft.structure === 'BY_WEEKDAY' ? slot.weekday : null;
    byWeekday.set(weekday, [...(byWeekday.get(weekday) ?? []), slot]);
  }

  const derived: DraftTarget[] = [];
  for (const [weekday, slots] of byWeekday) {
    for (const nutrient of NUTRIENT_KEYS) {
      if (hasExplicitDaily(weekday, nutrient)) continue;
      let sum = 0;
      let contributed = false;
      for (const slot of slots) {
        for (const item of firstOptionItems(slot)) {
          const value = item.nutrition?.values[nutrient];
          if (value === null || value === undefined || item.needsEstimate) continue;
          sum += value;
          contributed = true;
        }
      }
      if (!contributed) continue;
      derived.push({
        key: `estimated:${weekday ?? 'all'}:${nutrient}`,
        slotKey: null,
        weekday,
        nutrient,
        type: 'APPROXIMATE',
        low: Math.round(sum * 1000) / 1000,
        high: null,
        source: 'ESTIMATED',
        sourceExcerpt: null,
      });
    }
    if (hasExplicitDaily(weekday, 'ENERGY_KCAL') || slots.length === 0) continue;
    const ranges = slots.map((slot) =>
      explicit.find(
        (target) =>
          target.slotKey === slot.key &&
          target.nutrient === 'ENERGY_KCAL' &&
          target.type === 'RANGE',
      ),
    );
    if (ranges.every((range) => range !== undefined)) {
      derived.push({
        key: `sum:${weekday ?? 'all'}:ENERGY_KCAL`,
        slotKey: null,
        weekday,
        nutrient: 'ENERGY_KCAL',
        type: 'RANGE',
        low: ranges.reduce((acc, range) => acc + (range?.low ?? 0), 0),
        high: ranges.reduce((acc, range) => acc + (range?.high ?? 0), 0),
        source: 'SUM_OF_MEALS',
        sourceExcerpt: null,
      });
    }
  }
  return [...explicit, ...derived];
}

function userTagFor(ownerId: string): string {
  return createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
}

/**
 * Manual and edit drafts: items with no nutrition or a changed identity are
 * sent to `estimatePlanBaseline` (one `PLAN_BASELINE` operation, 60 s), the
 * results go into `draftJson` and the ESTIMATED daily targets are recomputed.
 * The AI call runs outside any transaction; the write is refused when the
 * draft moved on meanwhile.
 */
export async function estimateDraftBaseline(
  ownerId: string,
  draftRevision: number,
  now = new Date(),
): Promise<PlanDraft> {
  const { draft } = await requireDraft(ownerId, draftRevision);
  const pending: Array<{ input: BaselineItemInput; item: DraftItem }> = [];
  for (const slot of draft.slots)
    for (const option of slot.options)
      for (const item of option.items) {
        if (item.nutrition !== null && !item.needsEstimate) continue;
        pending.push({
          item,
          input: {
            index: pending.length,
            originalName: item.originalName,
            englishLabel: item.englishLabel,
            quantity: item.quantity,
            unit: item.unit,
            preparationNote: item.preparationNote,
            category: item.category,
          },
        });
      }

  const estimated = new Map<string, DraftItem['nutrition']>();
  if (pending.length > 0) {
    const localDate = localDateFor(now, APP_TIME_ZONE);
    const admission = await admitOperation(ownerId, 'PLAN_BASELINE', localDate);
    if (!admission.ok) {
      throw new ServiceError(
        t(admission.code === 'DAILY_AI_CAP' ? 'plan.errors.dailyCap' : 'plan.errors.aiUnavailable'),
        admission.code,
      );
    }
    const result = await estimatePlanBaseline({
      items: pending.map((p) => p.input),
      deadlineAt: now.getTime() + BASELINE_DEADLINE_MS,
      userTag: userTagFor(ownerId),
    });
    await finishOperation(admission.callId, result, draftRevision);
    if (!result.ok) {
      const timeout = result.reason === 'TIMEOUT';
      throw new ServiceError(
        t(timeout ? 'plan.errors.aiTimeout' : 'plan.errors.aiUnavailable'),
        timeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
      );
    }
    for (const row of result.data.items) {
      const target = pending[row.index];
      if (target) estimated.set(target.item.key, row.nutrition);
    }
  }

  // The draft may have moved on during the call; the revision check repeats.
  const { plan, draft: current } = await requireDraft(ownerId, draftRevision);
  const next: PlanDraft = {
    ...current,
    slots: current.slots.map((slot) => ({
      ...slot,
      options: slot.options.map((option) => ({
        ...option,
        items: option.items.map((item) =>
          estimated.has(item.key)
            ? { ...item, nutrition: estimated.get(item.key) ?? null, needsEstimate: false }
            : item,
        ),
      })),
    })),
  };
  next.targets = recomputeDerivedTargets(next);
  return writeDraft(ownerId, plan.draftId, next, draftRevision);
}

// ─── Confirm ──────────────────────────────────────────────────────────────

/**
 * Past linked meals whose slot disappears, or whose option disappears or
 * changes (an item added, removed or altered), when this draft is confirmed.
 * Import and manual drafts carry no ids, so every linked meal is affected.
 */
export async function countAffectedMeals(ownerId: string, draft: PlanDraft): Promise<number> {
  const plan = await findPlanWithRows(ownerId);
  if (!plan || plan.slots.length === 0) return 0;
  const active = draftFromRows(plan);
  const activeOptions = new Map<string, string>();
  for (const slot of active.slots)
    for (const option of slot.options)
      activeOptions.set(
        option.id ?? option.key,
        option.items.map((item) => `${item.id}:${itemIdentity(item)}`).join('|'),
      );

  const keptSlots = new Set<string>();
  const keptOptions = new Set<string>();
  for (const slot of draft.slots) {
    if (slot.id) keptSlots.add(slot.id);
    for (const option of slot.options) {
      if (!option.id || !activeOptions.has(option.id)) continue;
      const signature = option.items
        .map((item) => `${item.id ?? ''}:${itemIdentity(item)}`)
        .join('|');
      if (signature === activeOptions.get(option.id)) keptOptions.add(option.id);
    }
  }
  return prisma.meal.count({
    where: {
      userId: ownerId,
      planSlotId: { not: null },
      OR: [
        { planSlotId: { notIn: [...keptSlots] } },
        { planOptionId: { not: null, notIn: [...keptOptions] } },
      ],
    },
  });
}

/** Slots get `weekday = 7` outside weekday plans and a unique position per weekday. */
function normalizeSlots(draft: PlanDraft): DraftSlot[] {
  const counters = new Map<number, number>();
  return draft.slots.map((slot) => {
    const weekday = draft.structure === 'BY_WEEKDAY' ? slot.weekday : EVERY_DAY;
    const position = counters.get(weekday) ?? 0;
    counters.set(weekday, position + 1);
    return { ...slot, weekday, position };
  });
}

function targetData(
  planId: string,
  target: DraftTarget,
  slotIds: Map<string, string>,
): Prisma.PlanTargetCreateManyInput | null {
  const planSlotId = target.slotKey === null ? null : (slotIds.get(target.slotKey) ?? null);
  if (target.slotKey !== null && planSlotId === null) return null;
  return {
    planId,
    planSlotId,
    weekday: target.weekday,
    nutrient: target.nutrient,
    type: target.type,
    low: target.low,
    high: target.high,
    source: target.source,
    sourceExcerpt: target.sourceExcerpt,
    scopeKey: targetScopeKey(target.weekday, planSlotId, target.nutrient),
  };
}

/**
 * Applies the draft to the rows in one transaction: rows with an id are
 * updated in place, rows without one inserted, active rows absent from the
 * draft deleted (skipped-slot rows cascade; meal links go null through
 * `SetNull`). Targets and notes are replaced. Returns the count of
 * past linked meals affected, computed before the write.
 */
export async function confirmPlan(
  ownerId: string,
  draftRevision: number,
  now = new Date(),
): Promise<{ affectedMeals: number }> {
  const { plan, draft, kind } = await requireDraft(ownerId, draftRevision);
  const affectedMeals = await countAffectedMeals(ownerId, draft);
  const slots = normalizeSlots(draft);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.plan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        slots: { include: { options: { include: { items: { select: { id: true } } } } } },
      },
    });
    const activeSlotIds = new Set(existing.slots.map((s) => s.id));
    const activeOptionIds = new Set(existing.slots.flatMap((s) => s.options.map((o) => o.id)));
    const activeItemIds = new Set(
      existing.slots.flatMap((s) => s.options.flatMap((o) => o.items.map((i) => i.id))),
    );
    const draftSlotIds = new Set(slots.map((s) => s.id).filter((id): id is string => !!id));
    const draftOptionIds = new Set(
      slots.flatMap((s) => s.options.map((o) => o.id)).filter((id): id is string => !!id),
    );
    const draftItemIds = new Set(
      slots
        .flatMap((s) => s.options.flatMap((o) => o.items.map((i) => i.id)))
        .filter((id): id is string => !!id),
    );

    // Removed rows first: slots (cascade options, items, targets, skipped rows), then options, items.
    await tx.planSlot.deleteMany({
      where: { planId: plan.id, id: { notIn: [...draftSlotIds] } },
    });
    await tx.planOption.deleteMany({
      where: { slot: { planId: plan.id }, id: { notIn: [...draftOptionIds] } },
    });
    await tx.planItem.deleteMany({
      where: { option: { slot: { planId: plan.id } }, id: { notIn: [...draftItemIds] } },
    });

    // Kept slots park at temporary positions so reordering never trips the unique key.
    const keptSlots = slots.filter((s) => s.id && activeSlotIds.has(s.id));
    for (const [index, slot] of keptSlots.entries()) {
      await tx.planSlot.update({
        where: { id: slot.id },
        data: { position: -(index + 1), weekday: slot.weekday },
      });
    }

    const slotIds = new Map<string, string>();
    for (const slot of slots) {
      const data = {
        weekday: slot.weekday,
        position: slot.position,
        originalName: slot.originalName,
        englishLabel: slot.englishLabel,
        timeStart: slot.timeStart,
        timeEnd: slot.timeEnd,
        sourceExcerpt: slot.sourceExcerpt,
      };
      const slotRow =
        slot.id && activeSlotIds.has(slot.id)
          ? await tx.planSlot.update({ where: { id: slot.id }, data, select: { id: true } })
          : await tx.planSlot.create({ data: { planId: plan.id, ...data }, select: { id: true } });
      slotIds.set(slot.key, slotRow.id);

      for (const [optionIndex, option] of slot.options.entries()) {
        const optionData = { position: optionIndex, label: option.label };
        const optionRow =
          option.id && activeOptionIds.has(option.id)
            ? await tx.planOption.update({
                where: { id: option.id },
                data: optionData,
                select: { id: true },
              })
            : await tx.planOption.create({
                data: { planSlotId: slotRow.id, ...optionData },
                select: { id: true },
              });

        for (const [itemIndex, item] of option.items.entries()) {
          const itemData = {
            position: itemIndex,
            originalName: item.originalName,
            englishLabel: item.englishLabel,
            quantity: item.quantity,
            unit: item.unit,
            quantityAssumed: item.quantityAssumed,
            assumedDefaultKey: item.assumedDefaultKey,
            preparationNote: item.preparationNote,
            alternatives: item.alternatives as Prisma.InputJsonValue,
            category: item.category,
            nutrition:
              item.nutrition === null ? Prisma.DbNull : (item.nutrition as Prisma.InputJsonValue),
            sourceExcerpt: item.sourceExcerpt,
          };
          if (item.id && activeItemIds.has(item.id))
            await tx.planItem.update({ where: { id: item.id }, data: itemData });
          else await tx.planItem.create({ data: { planOptionId: optionRow.id, ...itemData } });
        }
      }
    }

    await tx.planTarget.deleteMany({ where: { planId: plan.id } });
    const targets = draft.targets
      .map((target) => targetData(plan.id, target, slotIds))
      .filter((row): row is Prisma.PlanTargetCreateManyInput => row !== null);
    const seen = new Set<string>();
    await tx.planTarget.createMany({
      data: targets.filter((row) => !seen.has(row.scopeKey) && seen.add(row.scopeKey)),
    });

    await tx.planNote.deleteMany({ where: { planId: plan.id } });
    await tx.planNote.createMany({
      data: draft.notes.map((note) => ({
        planId: plan.id,
        originalText: note.originalText,
        reason: note.reason,
      })),
    });

    await tx.plan.update({
      where: { id: plan.id },
      data: {
        status: 'ACTIVE',
        structure: draft.structure,
        name: draft.name,
        sourceNote: draft.sourceNote,
        sourceLanguage: draft.sourceLanguage,
        ...(kind === 'IMPORT' ? { sourceText: plan.draftSourceText } : {}),
        ...(kind === 'MANUAL' ? { sourceText: null } : {}),
        confirmedAt: now,
        draftJson: Prisma.DbNull,
        draftId: null,
        draftKind: null,
        draftSourceText: null,
      },
    });

    // The first listed weekday seeds the week start (product spec § 6), else Saturday.
    const firstWeekday = draft.structure === 'BY_WEEKDAY' ? slots[0]?.weekday : undefined;
    await tx.profile.updateMany({
      where: { userId: ownerId, weekStart: null },
      data: { weekStart: firstWeekday ?? DEFAULT_WEEK_START },
    });
  });

  await markStaleIfNeeded(ownerId, localDateFor(now, APP_TIME_ZONE));
  return { affectedMeals };
}

/** Deletes the rows and sets `status = NONE`; the typed confirmation must match the plan's name. */
export async function deletePlan(
  ownerId: string,
  confirmation: string,
  now = new Date(),
): Promise<void> {
  const plan = await requirePlanRow(ownerId);
  const expected = plan.name?.trim();
  if (expected && confirmation.trim().toLowerCase() !== expected.toLowerCase())
    throw new ServiceError(t('plan.errors.confirmationMismatch'), 'CONFIRMATION_MISMATCH');
  await cancelQueuedJobs(ownerId, now, ['QUEUED', 'RUNNING']);
  await prisma.$transaction([
    prisma.planSlot.deleteMany({ where: { planId: plan.id } }),
    prisma.planTarget.deleteMany({ where: { planId: plan.id } }),
    prisma.planNote.deleteMany({ where: { planId: plan.id } }),
    prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: 'NONE',
        structure: null,
        name: null,
        sourceNote: null,
        sourceLanguage: null,
        sourceText: null,
        confirmedAt: null,
        draftJson: Prisma.DbNull,
        draftId: null,
        draftKind: null,
        draftSourceText: null,
      },
    }),
  ]);
}
