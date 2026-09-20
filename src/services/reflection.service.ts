import { createHash, randomUUID } from 'node:crypto';
import type { MorningMessage, Prisma } from '@prisma/client';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import {
  factsHash,
  isReflectionStale,
  reflectionFacts,
  type ReflectionContext,
  type ReflectionFact,
} from '@/lib/rubric/facts';
import { t } from '@/lib/t';
import { addDays, localDateFor, localTimeFor } from '@/lib/time/local-date';
import { checkReflection, generateReflection } from '@/services/ai/generate-reflection';
import type { ReflectionOutput } from '@/services/ai/schemas';
import type { AiResult, GenerateReflectionInput, ProfileContext } from '@/services/ai/types';
import { admitOperation, finishOperation, type Admission } from '@/services/ai-usage.service';
import { recordEvent } from '@/services/analytics.service';
import { getDayView, isPlanActive } from '@/services/day-view.service';
import { greetingNameFor, toProfileView, type ProfileView } from '@/services/profile.service';
import {
  fallbackParagraph,
  isStaticState,
  pickFallbackState,
  type FallbackState,
} from '@/services/reflection/fallbacks';

/**
 * Morning message (product spec § 11, tech spec § 10.3). One canonical row per
 * user and local date, claimed with `INSERT … ON CONFLICT DO NOTHING`; the
 * claimer generates, everyone else reads or, after 20 s, takes over with the
 * fallback. Every finishing write is conditional on the claim it belongs to,
 * so a late provider response cannot overwrite a takeover (§ 21.12).
 *
 * The empty data states (first day, no records yesterday, no plan) have
 * nothing to reflect on: the claimer finishes at once with the static
 * paragraph and the provider is never admitted or called. A static paragraph
 * is not a fallback and is never marked stale, with one exception: a meal
 * added to yesterday after a "no records" paragraph makes it stale, so the
 * next Update regenerates with the provider.
 */

/** The AI call's total budget, shared by every stage (tech spec § 10.2). */
export const REFLECTION_DEADLINE_MS = 15_000;
/** A GENERATING row older than this is an owner that died (tech spec § 10.3). */
export const REFLECTION_TAKEOVER_MS = 20_000;
const RECENT_PARAGRAPHS = 3;

export interface ReflectionCard {
  status: 'READY' | 'GENERATING';
  paragraph: string | null;
  stale: boolean;
  /** "Got it" was tapped for this date: the card sits at the bottom of Today, collapsed. */
  acknowledged: boolean;
  /** A provider failure replaced by the deterministic paragraph for the data state. */
  isFallback: boolean;
  /** An empty data state written without a provider call (first day, no records, no plan). */
  isStatic: boolean;
  localDate: string;
}

function toCard(row: MorningMessage): ReflectionCard {
  return {
    status: row.status,
    paragraph: row.status === 'READY' ? row.paragraph : null,
    stale: row.stale,
    acknowledged: row.acknowledgedAt !== null,
    isFallback: row.isFallback,
    isStatic: row.isStatic,
    localDate: row.localDate,
  };
}

// ─── Facts ──────────────────────────────────────────────────────────────────

interface Owner {
  username: string;
  profile: ProfileView;
}

async function loadOwner(ownerId: string): Promise<Owner> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { username: true, profile: true },
  });
  if (!user?.profile) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  return { username: user.username, profile: toProfileView(user.profile) };
}

export function timeOfDayFor(now: Date, zone: string): ReflectionContext['timeOfDay'] {
  const hour = Number(localTimeFor(now, zone).slice(0, 2));
  return hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EVENING';
}

interface FactsBundle {
  facts: ReflectionFact[];
  context: ReflectionContext;
  profile: ProfileContext;
}

/** Tone-only personalization context (product spec § 11); never identifiers. */
function profileContextOf(profile: ProfileView): ProfileContext {
  return {
    ageYears: profile.ageYears,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
  };
}

/**
 * Product spec § 11 inputs: yesterday's view (when the user has any meal
 * before `localDate`), today's plan and confirmed meals (only to avoid a wrong
 * next step), the greeting name and the time of day from `now` in the zone.
 */
async function buildFacts(
  ownerId: string,
  localDate: string,
  now: Date,
  owner: Owner,
): Promise<FactsBundle> {
  const zone = owner.profile.timeZone;
  const [today, earlierMeal] = await Promise.all([
    getDayView(ownerId, localDate, now),
    prisma.meal.findFirst({
      where: { userId: ownerId, day: { localDate: { lt: localDate } } },
      select: { id: true },
    }),
  ]);
  const isFirstDay = earlierMeal === null;
  const yesterday = isFirstDay ? null : await getDayView(ownerId, addDays(localDate, -1), now);
  const profile = profileContextOf(owner.profile);
  const context: ReflectionContext = {
    greetingName: greetingNameFor(owner.profile, { username: owner.username }),
    timeOfDay: timeOfDayFor(now, zone),
    hasPlan: isPlanActive(today.plan),
    isFirstDay,
    profile,
  };
  const todaySlots = today.view.slots.map((s) => s.slot);
  return {
    facts: reflectionFacts(yesterday?.view ?? null, todaySlots, today.view, context),
    context,
    profile,
  };
}

/** Context for a fallback built from a stored snapshot (no views needed). */
function contextFromSnapshot(facts: ReflectionFact[], owner: Owner, now: Date): ReflectionContext {
  const plan = facts.find((f) => f.id === 'today:plan');
  return {
    greetingName: greetingNameFor(owner.profile, { username: owner.username }),
    timeOfDay: timeOfDayFor(now, owner.profile.timeZone),
    hasPlan: plan !== undefined && plan.signature !== 'NO_PLAN',
    isFirstDay: !facts.some((f) => f.id === 'coverage' || f.id === 'completeness'),
  };
}

function snapshotFacts(row: MorningMessage): ReflectionFact[] {
  return Array.isArray(row.factsSnapshot) ? (row.factsSnapshot as unknown as ReflectionFact[]) : [];
}

/** Opaque per-user tag for the provider; never the username (tech spec § 10.1). */
function userTagFor(ownerId: string): string {
  return createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
}

// ─── Finishing writes ───────────────────────────────────────────────────────

interface Claim {
  id: string;
  claimedAt: Date;
}

interface Finished {
  paragraph: string;
  usedFactIds: string[];
  isFallback: boolean;
  isStatic: boolean;
  fallbackState: FallbackState | null;
  providerModel: string | null;
}

/** The conditional update of § 10.3 step 2: only the claim that owns the row may finish it. */
async function finish(claim: Claim, result: Finished, now: Date): Promise<boolean> {
  const { count } = await prisma.morningMessage.updateMany({
    where: { id: claim.id, status: 'GENERATING', claimedAt: claim.claimedAt },
    data: {
      status: 'READY',
      paragraph: result.paragraph,
      usedFactIds: result.usedFactIds,
      isFallback: result.isFallback,
      isStatic: result.isStatic,
      fallbackState: result.fallbackState,
      providerModel: result.providerModel,
      generatedAt: now,
      stale: false,
    },
  });
  return count > 0;
}

/**
 * The deterministic paragraph for the data state: static for the empty
 * states, a fallback otherwise; an unusable snapshot gets the provider-failure
 * wording.
 */
function deterministicFor(facts: ReflectionFact[], context: ReflectionContext): Finished {
  const state: FallbackState =
    facts.length === 0 ? 'PROVIDER_FAILURE' : pickFallbackState(facts, context);
  const built = fallbackParagraph(state, facts, context);
  const isStatic = isStaticState(state);
  return {
    paragraph: built.paragraph,
    usedFactIds: built.usedFactIds,
    isFallback: !isStatic,
    isStatic,
    fallbackState: state,
    providerModel: null,
  };
}

/** True when the bundle describes an empty data state: no provider call is needed. */
function isStaticBundle(bundle: FactsBundle): boolean {
  return isStaticState(pickFallbackState(bundle.facts, bundle.context));
}

/**
 * The owner path (§ 10.3 step 2): a static state finishes at once; otherwise
 * admit, call the provider under the 15 s deadline, validate, and finish with
 * the paragraph or the fallback.
 */
async function generate(
  ownerId: string,
  localDate: string,
  claim: Claim,
  bundle: FactsBundle,
  now: Date,
  admission?: Admission,
): Promise<void> {
  const { facts, context } = bundle;
  if (isStaticBundle(bundle)) {
    await finish(claim, deterministicFor(facts, context), new Date());
    return;
  }
  const admitted = admission ?? (await admitOperation(ownerId, 'REFLECTION', localDate));
  let finished: Finished;
  let reason: string | null = null;
  if (!admitted.ok) {
    reason = admitted.code;
    finished = deterministicFor(facts, context);
  } else {
    const recent = await prisma.morningMessage.findMany({
      where: { userId: ownerId, status: 'READY', localDate: { lt: localDate } },
      orderBy: { localDate: 'desc' },
      take: RECENT_PARAGRAPHS,
      select: { paragraph: true },
    });
    const input: GenerateReflectionInput = {
      facts,
      profile: bundle.profile,
      greetingName: context.greetingName,
      timeOfDay: context.timeOfDay,
      recentParagraphs: recent.map((r) => r.paragraph).filter((p): p is string => !!p),
      deadlineAt: now.getTime() + REFLECTION_DEADLINE_MS,
      userTag: userTagFor(ownerId),
    };
    let result: AiResult<ReflectionOutput>;
    try {
      result = await generateReflection(input);
    } catch (error) {
      logger.warn({ err: error, ownerId }, 'reflection provider threw');
      result = {
        ok: false,
        reason: 'PROVIDER_ERROR',
        attempts: [],
        usage: { promptTokens: 0, completionTokens: 0 },
        durationMs: Date.now() - now.getTime(),
      };
    }
    const rejected = result.ok ? checkReflection(result.data, facts) : null;
    if (result.ok && rejected === null) {
      finished = {
        paragraph: result.data.paragraph,
        usedFactIds: result.data.usedFactIds,
        isFallback: false,
        isStatic: false,
        fallbackState: null,
        providerModel: result.model,
      };
    } else {
      reason = result.ok ? `SCHEMA_REJECTED:${rejected}` : result.reason;
      finished = deterministicFor(facts, context);
      if (result.ok) {
        result = {
          ok: false,
          reason: 'SCHEMA_REJECTED',
          attempts: result.attempts,
          usage: result.usage,
          durationMs: result.durationMs,
        };
      }
    }
    try {
      await finishOperation(admitted.callId, result);
    } catch (error) {
      logger.warn({ err: error, ownerId }, 'reflection usage not recorded');
    }
  }
  const won = await finish(claim, finished, new Date());
  if (finished.isFallback) {
    await recordEvent(
      'reflection_fallback',
      { state: finished.fallbackState, reason, won },
      ownerId,
    );
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

async function findMessage(ownerId: string, localDate: string): Promise<MorningMessage | null> {
  return prisma.morningMessage.findUnique({
    where: { userId_localDate: { userId: ownerId, localDate } },
  });
}

/**
 * § 10.3 steps 1–3. Facts are computed before the claim so the snapshot is
 * the input revision the paragraph is based on.
 */
export async function getOrCreateMessage(
  ownerId: string,
  localDate: string,
  now: Date,
): Promise<ReflectionCard> {
  const owner = await loadOwner(ownerId);
  const bundle = await buildFacts(ownerId, localDate, now, owner);
  const id = randomUUID();
  const snapshot = JSON.stringify(bundle.facts);
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "morning_messages"
      ("id", "userId", "localDate", "status", "claimedAt", "factsSnapshot", "factsHash", "createdAt", "updatedAt")
    VALUES (${id}, ${ownerId}, ${localDate}, 'GENERATING'::"MessageStatus", ${now}, ${snapshot}::jsonb, ${factsHash(bundle.facts)}, ${now}, ${now})
    ON CONFLICT ("userId", "localDate") DO NOTHING
    RETURNING "id"`;

  if (claimed.length > 0) {
    await generate(ownerId, localDate, { id, claimedAt: now }, bundle, now);
  } else {
    await readerPath(ownerId, localDate, owner, now);
  }
  const row = await findMessage(ownerId, localDate);
  if (!row) throw new ServiceError(t('reflection.errors.notFound'), 'NOT_FOUND');
  return toCard(row);
}

/** § 10.3 step 3: READY returns; a young GENERATING row polls; an old one is taken over. */
async function readerPath(ownerId: string, localDate: string, owner: Owner, now: Date) {
  const row = await findMessage(ownerId, localDate);
  if (!row || row.status === 'READY') return;
  if (now.getTime() - row.claimedAt.getTime() < REFLECTION_TAKEOVER_MS) return;
  const facts = snapshotFacts(row);
  const finished = deterministicFor(facts, contextFromSnapshot(facts, owner, now));
  const won = await finish({ id: row.id, claimedAt: row.claimedAt }, finished, now);
  if (won && finished.isFallback) {
    await recordEvent(
      'reflection_fallback',
      { state: finished.fallbackState, reason: 'TAKEOVER', won },
      ownerId,
    );
  }
}

/**
 * § 10.3 step 4: regenerate in place. Admission comes before the re-claim so
 * a capped user keeps the current paragraph (`DAILY_AI_CAP`); a static state
 * needs no admission.
 */
export async function updateMessage(
  ownerId: string,
  localDate: string,
  now: Date,
): Promise<ReflectionCard> {
  const existing = await findMessage(ownerId, localDate);
  if (!existing) return getOrCreateMessage(ownerId, localDate, now);
  const owner = await loadOwner(ownerId);
  const bundle = await buildFacts(ownerId, localDate, now, owner);
  const admission = isStaticBundle(bundle)
    ? undefined
    : await admitOperation(ownerId, 'REFLECTION', localDate);
  if (admission && !admission.ok) {
    throw new ServiceError(
      admission.code === 'DAILY_AI_CAP'
        ? t('reflection.errors.dailyCap')
        : t('reflection.errors.aiUnavailable'),
      admission.code,
    );
  }
  const claimedAt = now;
  await prisma.morningMessage.update({
    where: { id: existing.id },
    data: {
      status: 'GENERATING',
      claimedAt,
      factsSnapshot: bundle.facts as unknown as Prisma.InputJsonValue,
      factsHash: factsHash(bundle.facts),
      stale: false,
    },
  });
  await generate(ownerId, localDate, { id: existing.id, claimedAt }, bundle, now, admission);
  const row = await findMessage(ownerId, localDate);
  if (!row) throw new ServiceError(t('reflection.errors.notFound'), 'NOT_FOUND');
  return toCard(row);
}

/** "Got it": remembered per date across devices; the card moves to the bottom of Today. */
export async function acknowledge(ownerId: string, localDate: string, now: Date): Promise<void> {
  await prisma.morningMessage.updateMany({
    where: { userId: ownerId, localDate },
    data: { acknowledgedAt: now },
  });
}

/** The day's message as it is now, without claiming one (Today's first render places the card). */
export async function peekMessage(
  ownerId: string,
  localDate: string,
): Promise<ReflectionCard | null> {
  const row = await findMessage(ownerId, localDate);
  return row ? toCard(row) : null;
}

/** The reflection that looked back on `localDate`: the next day's message. Read-only, for History. */
export async function getMessageForDate(
  ownerId: string,
  localDate: string,
): Promise<ReflectionCard | null> {
  const row = await findMessage(ownerId, addDays(localDate, 1));
  return row && row.status === 'READY' ? toCard(row) : null;
}

/**
 * The facts whose change makes the paragraph stale. Context facts (name,
 * time of day) change without any log change and never count. A static
 * paragraph never goes stale, except "no records yesterday": a meal added to
 * yesterday changes its coverage fact, and the next Update has something to
 * reflect on.
 */
function trackedFactIds(row: MorningMessage): string[] {
  if (row.isStatic) return row.fallbackState === 'NO_RECORDS' ? ['coverage'] : [];
  return row.usedFactIds.filter((id) => !id.startsWith('ctx:'));
}

/**
 * Called by every meal, plan and completeness mutation with the date it
 * touched. Candidates: the message of the next day (its retrospective) and
 * today's (its "today" facts). Stale only when a used fact changed
 * (§ 21.13); never throws.
 */
export async function markStaleIfNeeded(
  ownerId: string,
  affectedDate: string,
  now = new Date(),
): Promise<void> {
  try {
    const owner = await loadOwner(ownerId);
    const today = localDateFor(now, owner.profile.timeZone);
    const candidates = [...new Set([addDays(affectedDate, 1), today])];
    const rows = await prisma.morningMessage.findMany({
      where: { userId: ownerId, localDate: { in: candidates }, status: 'READY', stale: false },
    });
    for (const row of rows) {
      const used = trackedFactIds(row);
      if (used.length === 0) continue;
      const { facts } = await buildFacts(ownerId, row.localDate, now, owner);
      if (!isReflectionStale(snapshotFacts(row), facts, used)) continue;
      await prisma.morningMessage.updateMany({
        where: { id: row.id, status: 'READY', generatedAt: row.generatedAt },
        data: { stale: true },
      });
    }
  } catch (error) {
    logger.warn({ err: error, ownerId, affectedDate }, 'reflection staleness check failed');
  }
}
