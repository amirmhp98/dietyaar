import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorningMessage } from '@prisma/client';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { profileFactory, userFactory } from '@/__tests__/factories';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { dayInput, eaten, fi, meal } from '@/__tests__/fixtures/plans/builders';
import { computeDayView } from '@/lib/rubric/day-view';
import { reflectionFacts, type ReflectionContext, type ReflectionFact } from '@/lib/rubric/facts';
import type { DayView } from '@/lib/rubric/types';
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
  acknowledge,
  getMessageForDate,
  getOrCreateMessage,
  markStaleIfNeeded,
  peekMessage,
  timeOfDayFor,
  updateMessage,
} from '@/services/reflection.service';

resetPrismaMock();

const OWNER = 'user-1';
const TODAY = '2026-09-17';
const YESTERDAY = '2026-09-16';
/** 2026-09-17 08:00 Tehran. */
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
    zone: 'Asia/Tehran',
    profileZone: 'Asia/Tehran',
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
    isStatic: false,
    acknowledgedAt: null,
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
    expect(timeOfDayFor(new Date('2026-09-17T04:30:00Z'), 'Asia/Tehran')).toBe('MORNING');
    expect(timeOfDayFor(new Date('2026-09-17T09:00:00Z'), 'Asia/Tehran')).toBe('AFTERNOON');
    expect(timeOfDayFor(new Date('2026-09-17T15:00:00Z'), 'Asia/Tehran')).toBe('EVENING');
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

describe('getOrCreateMessage — static states (no AI call)', () => {
  function finishedData() {
    return prismaMock.morningMessage.updateMany.mock.calls[0][0].data as Record<string, unknown>;
  }

  function expectNoProvider() {
    expect(admitOperation).not.toHaveBeenCalled();
    expect(generateReflection).not.toHaveBeenCalled();
    expect(finishOperation).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'new-id' }]);
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ isStatic: true }));
  });

  it('first day: the welcome paragraph, static, without admission or provider', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);

    const card = await getOrCreateMessage(OWNER, TODAY, NOW);

    expectNoProvider();
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { id: expect.any(String), status: 'GENERATING', claimedAt: NOW },
      data: expect.objectContaining({
        status: 'READY',
        isStatic: true,
        isFallback: false,
        fallbackState: 'FIRST_DAY',
        providerModel: null,
        stale: false,
      }),
    });
    expect(finishedData().paragraph).toBe(
      'Good morning, Sara. ' +
        t('reflection.fallback.firstDay.welcome') +
        ' ' +
        t('reflection.fallback.firstDay.startsWith', { slot: 'صبحانه' }) +
        ' ' +
        t('reflection.fallback.firstDay.tomorrow') +
        ' ' +
        t('reflection.fallback.close.morning'),
    );
    expect(card.isStatic).toBe(true);
  });

  it('no records yesterday: static, resting on the coverage fact', async () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    mockViews(empty);

    await getOrCreateMessage(OWNER, TODAY, NOW);

    expectNoProvider();
    const data = finishedData();
    expect(data).toMatchObject({ isStatic: true, isFallback: false, fallbackState: 'NO_RECORDS' });
    expect(data.paragraph).toBe(
      'Good morning, Sara. ' +
        t('reflection.fallback.noRecords.intro') +
        ' ' +
        t('reflection.fallback.noRecords.startsWith', { slot: 'صبحانه' }) +
        ' ' +
        t('reflection.fallback.noRecords.history') +
        ' ' +
        t('reflection.fallback.close.morning'),
    );
    expect(data.usedFactIds).toEqual(expect.arrayContaining(['coverage']));
  });

  it('no plan: static, and states nothing about yesterday', async () => {
    mockViews(yesterdayView(), todayView(), false);

    await getOrCreateMessage(OWNER, TODAY, NOW);

    expectNoProvider();
    const data = finishedData();
    expect(data).toMatchObject({ isStatic: true, isFallback: false, fallbackState: 'NO_PLAN' });
    expect(data.paragraph).toBe(
      'Good morning, Sara. ' +
        t('reflection.fallback.noPlan.body') +
        ' ' +
        t('reflection.fallback.close.morning'),
    );
    expect(data.usedFactIds).toEqual([]);
  });

  it('an evening first visit keeps the time-of-day greeting and close', async () => {
    prismaMock.meal.findFirst.mockResolvedValue(null);
    const evening = new Date('2026-09-17T15:00:00Z');

    await getOrCreateMessage(OWNER, TODAY, evening);

    const paragraph = finishedData().paragraph as string;
    expect(paragraph.startsWith('Good evening, Sara.')).toBe(true);
    expect(paragraph.endsWith(t('reflection.fallback.close.evening'))).toBe(true);
    expectNoProvider();
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
      acknowledged: false,
      isFallback: false,
      isStatic: false,
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

  it('a static state regenerates without admission (nothing to cap)', async () => {
    mockViews(yesterdayView(), todayView(), false);
    prismaMock.morningMessage.findUnique
      .mockResolvedValueOnce(messageRow({ isStatic: true, fallbackState: 'NO_PLAN' }))
      .mockResolvedValueOnce(messageRow({ isStatic: true, fallbackState: 'NO_PLAN' }));
    prismaMock.morningMessage.update.mockResolvedValue(messageRow());
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });

    const card = await updateMessage(OWNER, TODAY, NOW);

    expect(admitOperation).not.toHaveBeenCalled();
    expect(generateReflection).not.toHaveBeenCalled();
    expect(card.isStatic).toBe(true);
  });

  it('a "no records" paragraph made stale by a meal added to yesterday regenerates with the provider', async () => {
    const existing = messageRow({ isStatic: true, fallbackState: 'NO_RECORDS', stale: true });
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
    expect(generateReflection).toHaveBeenCalledTimes(1);
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isStatic: false, isFallback: false, stale: false }),
      }),
    );
    expect(card.paragraph).toBe(okParagraph);
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

describe('acknowledge / peekMessage / getMessageForDate', () => {
  it('Got it stores the timestamp per date, scoped to the owner', async () => {
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    await acknowledge(OWNER, TODAY, NOW);
    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { userId: OWNER, localDate: TODAY },
      data: { acknowledgedAt: NOW },
    });
  });

  it('peekMessage reads the day without claiming it and reports the acknowledgement', async () => {
    prismaMock.morningMessage.findUnique.mockResolvedValue(messageRow({ acknowledgedAt: NOW }));
    expect(await peekMessage(OWNER, TODAY)).toMatchObject({ acknowledged: true });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    prismaMock.morningMessage.findUnique.mockResolvedValue(null);
    expect(await peekMessage(OWNER, TODAY)).toBeNull();
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

  it('a static "no records" paragraph goes stale when a meal is added to yesterday', async () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    prismaMock.morningMessage.findMany.mockResolvedValue([
      messageRow({
        isStatic: true,
        fallbackState: 'NO_RECORDS',
        factsSnapshot: facts(empty) as never,
        usedFactIds: ['coverage', 'today:next', 'today:plan'],
      }),
    ]);
    prismaMock.morningMessage.updateMany.mockResolvedValue({ count: 1 });
    mockViews(yesterdayView());

    await markStaleIfNeeded(OWNER, YESTERDAY, NOW);

    expect(prismaMock.morningMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'msg-1', status: 'READY', generatedAt: NOW },
      data: { stale: true },
    });
  });

  it('a static "no records" paragraph ignores changes to today (only the coverage fact counts)', async () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    prismaMock.morningMessage.findMany.mockResolvedValue([
      messageRow({
        isStatic: true,
        fallbackState: 'NO_RECORDS',
        factsSnapshot: facts(empty) as never,
        usedFactIds: ['coverage', 'today:next', 'today:plan'],
      }),
    ]);
    const breakfastLogged = computeDayView(
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
    mockViews(empty, breakfastLogged);

    await markStaleIfNeeded(OWNER, TODAY, NOW);

    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
  });

  it('first-day and no-plan static paragraphs never go stale', async () => {
    prismaMock.morningMessage.findMany.mockResolvedValue([
      messageRow({
        isStatic: true,
        fallbackState: 'FIRST_DAY',
        factsSnapshot: facts(null, todayView(), { isFirstDay: true }) as never,
        usedFactIds: ['today:next', 'today:plan'],
      }),
    ]);
    mockViews(yesterdayView());
    await markStaleIfNeeded(OWNER, YESTERDAY, NOW);
    expect(prismaMock.morningMessage.updateMany).not.toHaveBeenCalled();
    expect(getDayView).not.toHaveBeenCalled();
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
    expect(out.paragraph).toContain('ناهار matched the plan.');
    expect(out.paragraph).toContain("Today's plan starts with صبحانه.");
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

  it('NO_RECORDS: reads as written, names the first slot, and points to History', () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    const out = fallbackParagraph('NO_RECORDS', facts(empty), ctx);
    expect(out.paragraph).toBe(
      'Good morning, Sara. Yesterday went by without any meals logged — that happens, and nothing is lost. ' +
        'Today is a fresh page: your plan starts with صبحانه, and logging it takes a few taps. ' +
        "If you'd like to fill in yesterday, History is always open. One meal at a time is plenty.",
    );
    expect(out.paragraph).not.toMatch(BANNED);
    expect(out.usedFactIds).toEqual(expect.arrayContaining(['coverage', 'today:next']));
  });

  it('NO_RECORDS: a later slot in the afternoon, and no dangling sentence for a target-only plan', () => {
    const empty = computeDayView(dayInput(plan.slots, { localDate: YESTERDAY, meals: [] }));
    const afternoon = { greetingName: 'Sara', timeOfDay: 'AFTERNOON' as const };
    const later = computeDayView(
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
    expect(fallbackParagraph('NO_RECORDS', facts(empty, later), afternoon).paragraph).toContain(
      'Today is a fresh page: the next meal in your plan is میان‌وعده اول, and logging it takes a few taps.',
    );

    const targetsOnly = reflectionFacts(empty, [], todayView(), context);
    const out = fallbackParagraph('NO_RECORDS', targetsOnly, ctx);
    expect(out.paragraph).toBe(
      'Good morning, Sara. Yesterday went by without any meals logged — that happens, and nothing is lost. ' +
        "If you'd like to fill in yesterday, History is always open. One meal at a time is plenty.",
    );
  });

  it('FIRST_DAY: welcomes, names the first slot, and promises tomorrow’s card', () => {
    const out = fallbackParagraph('FIRST_DAY', facts(null, todayView(), { isFirstDay: true }), ctx);
    expect(out.paragraph).toBe(
      "Good morning, Sara. Welcome — there's nothing to look back on yet, and today is day one. " +
        'Your plan starts with صبحانه; when you eat it, log it and adjust the portions to what you actually had. ' +
        'From tomorrow on, this card will tell you how the day before went. One meal at a time is plenty.',
    );
    expect(out.paragraph).not.toMatch(BANNED);
    expect(out.usedFactIds).toEqual(['today:next', 'today:plan']);
  });

  it('FIRST_DAY without a plan: the plan invitation instead of a slot', () => {
    const out = fallbackParagraph(
      'FIRST_DAY',
      facts(null, null, { isFirstDay: true, hasPlan: false }),
      ctx,
    );
    expect(out.paragraph).toBe(
      "Good morning, Sara. Welcome — there's nothing to look back on yet, and today is day one. " +
        t('reflection.fallback.firstDay.noPlan') +
        ' From tomorrow on, this card will tell you how the day before went. One meal at a time is plenty.',
    );
    expect(out.usedFactIds).toEqual([]);
  });

  it('NO_PLAN: invites plan setup, invents no targets, states nothing about yesterday', () => {
    const out = fallbackParagraph('NO_PLAN', facts(yesterdayView(), null, { hasPlan: false }), ctx);
    expect(out.paragraph).toBe(
      "Good morning, Sara. Your meals can't be compared with anything yet because there's no plan. " +
        "Add it from the Plan tab whenever you're ready; until then, everything you log still counts towards your totals. " +
        'One meal at a time is plenty.',
    );
    expect(out.paragraph).not.toContain('prescribed meals');
    expect(out.usedFactIds).toEqual([]);
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
    expect(out.paragraph).toContain('The next meal in your plan is میان‌وعده اول.');
    expect(out.paragraph).not.toContain('starts with');
  });
});
