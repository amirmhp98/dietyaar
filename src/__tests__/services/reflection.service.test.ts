import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorningMessage } from '@prisma/client';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { profileFactory, userFactory } from '@/__tests__/factories';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { dayInput, eaten, fi, meal } from '@/__tests__/fixtures/plans/builders';
import { computeDayView } from '@/lib/rubric/day-view';
import { reflectionFacts, type ReflectionContext, type ReflectionFact } from '@/lib/rubric/facts';
import type { DayView } from '@/lib/rubric/types';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { wordCount } from '@/services/ai/schemas';
import { t } from '@/lib/t';

vi.mock('@/services/day-view.service', () => ({
  getDayView: vi.fn(),
  isPlanActive: (plan: unknown) => plan !== null,
}));
vi.mock('@/services/ai/generate-reflection', () => ({
  generateReflection: vi.fn(),
  checkReflection: vi.fn(() => null),
}));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call-1' })),
  finishOperation: vi.fn(async () => {}),
}));
vi.mock('@/services/analytics.service', () => ({ recordEvent: vi.fn(async () => {}) }));

import { checkReflection, generateReflection } from '@/services/ai/generate-reflection';
import { admitOperation, finishOperation } from '@/services/ai-usage.service';
import { recordEvent } from '@/services/analytics.service';
import { getDayView } from '@/services/day-view.service';
import {
  FALLBACK_MAX_WORDS,
  FALLBACK_MIN_WORDS,
  fallbackParagraph,
  pickFallbackState,
} from '@/services/reflection/fallbacks';
import {
  getMessageForDate,
  getOrCreateMessage,
  markStaleIfNeeded,
  setCollapsed,
  timeOfDayFor,
  updateMessage,
} from '@/services/reflection.service';

resetPrismaMock();

const OWNER = 'user-1';
const TODAY = '2026-09-17';
const YESTERDAY = '2026-09-16';
/** 2026-09-17 08:30 in Asia/Dubai. */
const NOW = new Date('2026-09-17T04:30:00Z');
const BANNED = /\b(cheat|exercise|training|workout|fasting|good food|bad food|confirmed)\b/i;

const plan = buildMenuPlan();

/** Yesterday: lunch matched, dinner a different food, breakfast skipped, the rest unrecorded. */
function yesterdayView(overrides: Partial<Parameters<typeof dayInput>[1]> = {}): DayView {
  const lunch = plan.lunch.options[0];
  return computeDayView(
    dayInput(plan.slots, {
      localDate: YESTERDAY,
      meals: [
        meal(
          plan.lunch.id,
          lunch.id,
          '13:00',
          lunch.items.map((i) => eaten(i)),
        ),
        meal(plan.dinner.id, plan.dinner.options[0].id, '20:00', [
          fi('پیتزا', 'pizza', 2, 'slice', 'OTHER', 500),
        ]),
      ],
      skippedSlotIds: [plan.breakfast.id],
      targets: plan.targets,
      ...overrides,
    }),
  );
}

function todayView(): DayView {
  return computeDayView(
    dayInput(plan.slots, { localDate: TODAY, dayPhase: 'ONGOING', hasRecord: false }),
  );
}

function dayResult(view: DayView, withPlan = true) {
  return {
    view,
    meals: [],
    zone: APP_TIME_ZONE,
    weekStart: 6,
    plan: withPlan ? { id: 'plan-1' } : null,
    planChangedInPeriod: false,
  } as never;
}

function messageRow(overrides: Partial<MorningMessage> = {}): MorningMessage {
  return {
    id: 'msg-1',
    userId: OWNER,
    localDate: TODAY,
    status: 'READY',
    paragraph: 'A ready paragraph.',
    isFallback: false,
    fallbackState: null,
    factsSnapshot: [],
    factsHash: '',
    usedFactIds: [],
    generatedAt: NOW,
    claimedAt: NOW,
    providerModel: 'deepseek-flash',
    stale: false,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const context: ReflectionContext = {
  greetingName: 'Sara',
  timeOfDay: 'MORNING',
  hasPlan: true,
  isFirstDay: false,
};

function facts(
  yesterday: DayView | null,
  today: DayView | null = todayView(),
  ctx: Partial<ReflectionContext> = {},
): ReflectionFact[] {
  const c = { ...context, ...ctx };
  return reflectionFacts(yesterday, c.hasPlan ? plan.slots : [], today, c);
}

/** `getDayView` answers today's date and yesterday's date from the given views. */
function mockViews(yesterday: DayView | null, today: DayView = todayView(), withPlan = true) {
  vi.mocked(getDayView).mockImplementation(async (_owner, localDate) =>
    dayResult(localDate === TODAY ? today : (yesterday ?? todayView()), withPlan),
  );
}

const okParagraph =
  'Good morning, Sara. Yesterday your lunch matched the plan, while a different food was recorded for dinner. ' +
  'Today starts with breakfast; log it when you eat it and adjust the portions to what you actually had. ' +
  'One meal at a time is enough, and there is no need to make up for anything from yesterday.';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkReflection).mockReturnValue(null);
  prismaMock.user.findUnique.mockResolvedValue({
    ...userFactory.build({ id: OWNER, username: 'sara' }),
    profile: profileFactory.build({ userId: OWNER, displayName: 'Sara' }),
  } as never);
  prismaMock.meal.findFirst.mockResolvedValue({ id: 'm-old' } as never);
  prismaMock.morningMessage.findMany.mockResolvedValue([]);
  mockViews(yesterdayView());
});

describe('timeOfDayFor', () => {
  it('splits the day at 12:00 and 18:00 in the zone', () => {
    expect(timeOfDayFor(new Date('2026-09-17T04:30:00Z'), APP_TIME_ZONE)).toBe('MORNING');
    expect(timeOfDayFor(new Date('2026-09-17T09:00:00Z'), APP_TIME_ZONE)).toBe('AFTERNOON');
    expect(timeOfDayFor(new Date('2026-09-17T15:00:00Z'), APP_TIME_ZONE)).toBe('EVENING');
  });
});

describe('getOrCreateMessage — owner path', () => {
  it('claims the row, calls the provider once and writes READY under the conditional update', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: true,
      data: { paragraph: okParagraph, usedFactIds: [`slot:${plan.lunch.id}`, 'today:next'] },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'deepseek-flash',
      durationMs: 10,
    });
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ paragraph: okParagraph }));

    const card = await getOrCreateMessage(OWNER, TODAY, NOW);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(admitOperation).toHaveBeenCalledWith(OWNER, 'REFLECTION', TODAY);
    expect(generateReflection).toHaveBeenCalledTimes(1);
    const input = vi.mocked(generateReflection).mock.calls[0][0];
    expect(input.deadlineAt).toBe(NOW.getTime() + 15_000);
    expect(input.timeOfDay).toBe('MORNING');
    expect(input.greetingName).toBe('Sara');
    expect(input.userTag).not.toContain('sara');
    expect(input.facts.some((f) => f.id === `slot:${plan.lunch.id}`)).toBe(true);
    expect(finishOperation).toHaveBeenCalledWith('call-1', expect.objectContaining({ ok: true }));
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { id: expect.any(String), status: 'GENERATING', claimedAt: NOW },
      data: expect.objectContaining({
        status: 'READY',
        paragraph: okParagraph,
        usedFactIds: [`slot:${plan.lunch.id}`, 'today:next'],
        isFallback: false,
        providerModel: 'deepseek-flash',
      }),
    });
    expect(card).toMatchObject({ status: 'READY', paragraph: okParagraph, isFallback: false });
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('provider failure → the fallback for the data state, recorded as a fallback event', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: false,
      reason: 'TIMEOUT',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 15_000,
    });
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ isFallback: true }));

    await getOrCreateMessage(OWNER, TODAY, NOW);

    const data = prismaMock.morningMessage.updateMany.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.isFallback).toBe(true);
    expect(data.fallbackState).toBe('COMPLETE');
    expect(data.paragraph).toContain('Good morning, Sara.');
    expect(data.usedFactIds).toEqual(expect.arrayContaining(['coverage']));
    expect(recordEvent).toHaveBeenCalledWith(
      'reflection_fallback',
      expect.objectContaining({ state: 'COMPLETE', reason: 'TIMEOUT' }),
      OWNER,
    );
  });

  it('a rejected paragraph is a SCHEMA_REJECTED usage record and the fallback', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: true,
      data: { paragraph: 'Great job, no cheating!', usedFactIds: ['nope'] },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'deepseek-flash',
      durationMs: 10,
    });
    vi.mocked(checkReflection).mockReturnValue('UNKNOWN_FACT' as never);
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ isFallback: true }));

    await getOrCreateMessage(OWNER, TODAY, NOW);

    expect(finishOperation).toHaveBeenCalledWith(
      'call-1',
      expect.objectContaining({ ok: false, reason: 'SCHEMA_REJECTED' }),
    );
    const data = prismaMock.morningMessage.updateMany.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.isFallback).toBe(true);
    expect(data.paragraph).not.toContain('cheating');
  });

  it('a capped or unavailable admission writes the fallback without calling the provider', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(admitOperation).mockResolvedValueOnce({ ok: false, code: 'AI_UNAVAILABLE' });
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ isFallback: true }));

    await getOrCreateMessage(OWNER, TODAY, NOW);
    expect(generateReflection).not.toHaveBeenCalled();
    expect(finishOperation).not.toHaveBeenCalled();
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateMessage — reader path', () => {
  it('READY returns the paragraph without generating', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow());
    const card = await getOrCreateMessage(OWNER, TODAY, NOW);
    expect(card).toEqual({
      status: 'READY',
      paragraph: 'A ready paragraph.',
      stale: false,
      collapsed: false,
      isFallback: false,
      localDate: TODAY,
    });
    expect(generateReflection).not.toHaveBeenCalled();
    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
  });

  it('GENERATING younger than 20 s returns GENERATING for the client to poll', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.morningMessage.findUnique.mockResolvedValue(
      messageRow({
        status: 'GENERATING',
        paragraph: null,
        claimedAt: new Date(NOW.getTime() - 19_000),
      }),
    );
    const card = await getOrCreateMessage(OWNER, TODAY, NOW);
    expect(card.status).toBe('GENERATING');
    expect(card.paragraph).toBeNull();
    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
  });

  it('GENERATING older than 20 s is taken over with the fallback from the snapshot (TS-§21.12)', async () => {
    const snapshot = facts(yesterdayView());
    const claimedAt = new Date(NOW.getTime() - 21_000);
    prismaMock.$queryRaw.mockResolvedValue([]);
    const generating = messageRow({
      status: 'GENERATING',
      paragraph: null,
      claimedAt,
      factsSnapshot: snapshot as never,
    });
    prismaMock.morningMessage.findUnique
      .mockResolvedValueOnce(generating)
      .mockResolvedValueOnce(messageRow({ isFallback: true, paragraph: 'fallback' }));
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });

    const card = await getOrCreateMessage(OWNER, TODAY, NOW);

    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'msg-1', status: 'GENERATING', claimedAt },
      data: expect.objectContaining({
        status: 'READY',
        isFallback: true,
        fallbackState: 'COMPLETE',
      }),
    });
    expect(card).toMatchObject({ status: 'READY', isFallback: true });
    expect(generateReflection).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(
      'reflection_fallback',
      expect.objectContaining({ reason: 'TAKEOVER' }),
      OWNER,
    );
  });

  it("a late provider write after a takeover affects zero rows and the reader's fallback stands", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: true,
      data: { paragraph: okParagraph, usedFactIds: [] },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'deepseek-flash',
      durationMs: 25_000,
    });
    // The row was already finished by a reader: the conditional update matches nothing.
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(
      messageRow({ paragraph: 'fallback', isFallback: true }),
    );

    const card = await getOrCreateMessage(OWNER, TODAY, NOW);
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledTimes(1);
    expect(card.paragraph).toBe('fallback');
    expect(card.isFallback).toBe(true);
  });
});

describe('updateMessage', () => {
  it('re-claims with a new claimedAt and repeats the owner path', async () => {
    const existing = messageRow({ claimedAt: new Date('2026-09-17T03:00:00Z') });
    prismaMock.morningMessage.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(messageRow({ paragraph: okParagraph }));
    prismaMock.morningMessage.update.mockResolvedValue(existing);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: true,
      data: { paragraph: okParagraph, usedFactIds: [] },
      attempts: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'deepseek-flash',
      durationMs: 10,
    });
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });

    const card = await updateMessage(OWNER, TODAY, NOW);

    expect(admitOperation).toHaveBeenCalledTimes(1);
    expect(prismaMock.morningMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: expect.objectContaining({ status: 'GENERATING', claimedAt: NOW, stale: false }),
    });
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'msg-1', status: 'GENERATING', claimedAt: NOW } }),
    );
    expect(card.paragraph).toBe(okParagraph);
  });

  it('DAILY_AI_CAP keeps the current paragraph and throws', async () => {
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow());
    vi.mocked(admitOperation).mockResolvedValueOnce({ ok: false, code: 'DAILY_AI_CAP' });
    await expect(updateMessage(OWNER, TODAY, NOW)).rejects.toMatchObject({
      code: 'DAILY_AI_CAP',
      message: t('reflection.errors.dailyCap'),
    });
    expect(prismaMock.morningMessage.update).not.toHaveBeenCalled();
    expect(generateReflection).not.toHaveBeenCalled();
  });

  it('without a row it behaves like the first visit', async () => {
    prismaMock.morningMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(messageRow());
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    vi.mocked(generateReflection).mockResolvedValue({
      ok: false,
      reason: 'UNAVAILABLE',
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 0,
    });
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    await updateMessage(OWNER, TODAY, NOW);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('setCollapsed / getMessageForDate', () => {
  it('persists the collapse per date, scoped to the owner', async () => {
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    await setCollapsed(OWNER, TODAY, true);
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { userId: OWNER, localDate: TODAY },
      data: { collapsed: true },
    });
  });

  it('History reads the next day’s message and ignores one still generating', async () => {
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow());
    expect(await getMessageForDate(OWNER, YESTERDAY)).toMatchObject({ localDate: TODAY });
    expect(prismaMock.morningMessage.findUnique).toHaveBeenCalledWith({
      where: { userId_localDate: { userId: OWNER, localDate: TODAY } },
    });
    prismaMock.morningMessage.findUnique.mockResolvedValue(
      messageRow({ status: 'GENERATING', paragraph: null }),
    );
    expect(await getMessageForDate(OWNER, YESTERDAY)).toBeNull();
  });
});

describe('markStaleIfNeeded (TS-§21.13)', () => {
  const lunchFact = `slot:${plan.lunch.id}`;

  function readyWith(snapshot: ReflectionFact[], usedFactIds: string[]) {
    prismaMock.morningMessage.findMany.mockResolvedValue([
      messageRow({ factsSnapshot: snapshot as never, usedFactIds }),
    ]);
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
  }

  it('editing yesterday’s lunch from Matched to Different food marks the message stale', async () => {
    readyWith(facts(yesterdayView()), [lunchFact, 'today:next']);
    mockViews(
      yesterdayView({
        meals: [
          meal(plan.lunch.id, plan.lunch.options[0].id, '13:00', [
            fi('پیتزا', 'pizza', 2, 'slice', 'OTHER', 500),
          ]),
        ],
      }),
    );

    await markStaleIfNeeded(OWNER, YESTERDAY, NOW);

    expect(prismaMock.morningMessage.findMany).toHaveBeenCalledWith({
      where: { userId: OWNER, localDate: { in: [TODAY] }, status: 'READY', stale: false },
    });
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'msg-1', status: 'READY', generatedAt: NOW },
      data: { stale: true },
    });
  });

  it('a note edit (same facts) does not mark it stale', async () => {
    readyWith(facts(yesterdayView()), [lunchFact, 'coverage']);
    await markStaleIfNeeded(OWNER, YESTERDAY, NOW);
    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
  });

  it('a change to a fact the paragraph did not use does not mark it stale', async () => {
    readyWith(facts(yesterdayView()), [lunchFact]);
    mockViews(yesterdayView({ skippedSlotIds: [] }));
    await markStaleIfNeeded(OWNER, YESTERDAY, NOW);
    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
  });

  it('checks the next day’s message and today’s for an older date', async () => {
    prismaMock.morningMessage.findMany.mockResolvedValue([]);
    await markStaleIfNeeded(OWNER, '2026-09-10', NOW);
    expect(prismaMock.morningMessage.findMany).toHaveBeenCalledWith({
      where: {
        userId: OWNER,
        localDate: { in: ['2026-09-11', TODAY] },
        status: 'READY',
        stale: false,
      },
    });
  });

  it('never throws', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(markStaleIfNeeded(OWNER, YESTERDAY)).resolves.toBeUndefined();
  });
});

describe('fallbacks', () => {
  const ctx = { greetingName: 'Sara', timeOfDay: 'MORNING' as const };

  function check(paragraph: string) {
    const words = wordCount(paragraph);
    expect(words).toBeGreaterThanOrEqual(FALLBACK_MIN_WORDS);
    expect(words).toBeLessThanOrEqual(FALLBACK_MAX_WORDS);
    expect(paragraph).not.toMatch(BANNED);
    expect(paragraph.startsWith('Good morning, Sara.')).toBe(true);
  }

  it('picks the state from the facts and context', () => {
    expect(pickFallbackState([], { hasPlan: true, isFirstDay: true })).toBe('FIRST_DAY');
    expect(pickFallbackState([], { hasPlan: false, isFirstDay: false })).toBe('NO_PLAN');
    expect(pickFallbackState(facts(null), context)).toBe('NO_RECORDS');
    expect(
      pickFallbackState(
        facts(computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }))),
        context,
      ),
    ).toBe('NO_RECORDS');
    expect(pickFallbackState(facts(yesterdayView({ logComplete: false })), context)).toBe(
      'UNCHECKED',
    );
    expect(pickFallbackState(facts(yesterdayView()), context)).toBe('COMPLETE');
  });

  it('COMPLETE: coverage, one match, one focus and today’s first slot', () => {
    const f = facts(yesterdayView());
    const out = fallbackParagraph('COMPLETE', f, ctx);
    check(out.paragraph);
    expect(out.paragraph).toContain('ناهار (Lunch) matched the plan.');
    expect(out.paragraph).toContain("Today's plan starts with صبحانه (Breakfast).");
    expect(out.usedFactIds).toEqual(
      expect.arrayContaining(['coverage', `slot:${plan.lunch.id}`, 'today:next']),
    );
    expect(out.usedFactIds).not.toContain('ctx:time');
  });

  it('UNCHECKED: says it covers recorded meals only', () => {
    const out = fallbackParagraph('UNCHECKED', facts(yesterdayView({ logComplete: false })), ctx);
    check(out.paragraph);
    expect(out.paragraph).toContain(t('reflection.fallback.unchecked.intro'));
    expect(out.usedFactIds).toContain('completeness');
  });

  it('NO_RECORDS: acknowledges the absence and suggests the next slot', () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    const out = fallbackParagraph('NO_RECORDS', facts(empty), ctx);
    check(out.paragraph);
    expect(out.paragraph).toContain('No meals were recorded yesterday');
    expect(out.usedFactIds).toEqual(expect.arrayContaining(['coverage', 'today:next']));
  });

  it('FIRST_DAY: welcomes and lists today’s plan without a yesterday', () => {
    const out = fallbackParagraph('FIRST_DAY', facts(null, todayView(), { isFirstDay: true }), ctx);
    check(out.paragraph);
    expect(out.paragraph).toContain("Today's plan, in order:");
    expect(out.paragraph).not.toContain('yesterday');
    expect(out.usedFactIds).toEqual(['today:plan']);
  });

  it('NO_PLAN: invites plan setup and invents no targets', () => {
    const out = fallbackParagraph('NO_PLAN', facts(yesterdayView(), null, { hasPlan: false }), ctx);
    check(out.paragraph);
    expect(out.paragraph).toContain("There's no active plan yet");
    expect(out.paragraph).not.toContain("Today's plan");
  });

  it('PROVIDER_FAILURE: neutral, factual, time-appropriate', () => {
    const evening = fallbackParagraph('PROVIDER_FAILURE', [], {
      greetingName: 'Sara',
      timeOfDay: 'EVENING',
    });
    const words = wordCount(evening.paragraph);
    expect(words).toBeGreaterThanOrEqual(FALLBACK_MIN_WORDS);
    expect(evening.paragraph).toContain('Good evening, Sara.');
    expect(evening.paragraph).toContain(t('reflection.fallback.close.evening'));
    expect(evening.usedFactIds).toEqual([]);
  });

  it('an afternoon visit does not point the user back to breakfast once it is recorded', () => {
    const today = computeDayView(
      dayInput(plan.slots, {
        localDate: TODAY,
        dayPhase: 'ONGOING',
        meals: [
          meal(plan.breakfast.id, plan.breakfast.options[0].id, '08:00', [
            eaten(plan.breakfast.options[0].items[0]),
          ]),
        ],
      }),
    );
    const out = fallbackParagraph('COMPLETE', facts(yesterdayView(), today), {
      greetingName: 'Sara',
      timeOfDay: 'AFTERNOON',
    });
    expect(out.paragraph).toContain('The next meal in your plan is میان‌وعده اول (First snack).');
    expect(out.paragraph).not.toContain('starts with');
  });
});
