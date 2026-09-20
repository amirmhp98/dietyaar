import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestUser, resetDatabase } from '@/__tests__/integration/db';

/**
 * TS-§21.11 "Reflection single flight": twenty concurrent first-visit requests
 * produce one GENERATING row, one AI call and twenty identical paragraphs.
 * TS-§21.12 "Reflection owner dies": a GENERATING row older than 20 s is
 * completed with the fallback by the next reader, and the late provider
 * write affects zero rows. Both need something to reflect on (a plan and a
 * meal yesterday); an empty state finishes with the static paragraph and
 * never reaches the provider. Real Postgres; the provider and admission are
 * mocked.
 */
vi.mock('@/services/ai/generate-reflection', () => ({
  generateReflection: vi.fn(),
  checkReflection: vi.fn(() => null),
}));
vi.mock('@/services/ai-usage.service', () => ({
  admitOperation: vi.fn(async () => ({ ok: true, callId: 'call-1' })),
  finishOperation: vi.fn(async () => {}),
}));

import { generateReflection } from '@/services/ai/generate-reflection';
import { admitOperation } from '@/services/ai-usage.service';
import { getOrCreateMessage } from '@/services/reflection.service';
import { addDays } from '@/lib/time/local-date';

const LOCAL_DATE = '2026-09-17';

/** A one-slot plan and a matching meal on the day before `localDate`: a comparable yesterday. */
async function seedYesterday(userId: string, localDate: string) {
  const plan = await prisma.plan.create({
    data: {
      userId,
      status: 'ACTIVE',
      structure: 'SAME_EVERY_DAY',
      confirmedAt: new Date('2026-09-01T00:00:00Z'),
      slots: {
        create: [
          {
            weekday: 7,
            position: 0,
            originalName: 'Breakfast',
            englishLabel: 'Breakfast',
            options: {
              create: [
                {
                  position: 0,
                  items: {
                    create: [
                      {
                        position: 0,
                        originalName: 'egg',
                        englishLabel: 'egg',
                        quantity: 2,
                        unit: 'piece',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: { slots: { include: { options: true } } },
  });
  const yesterday = addDays(localDate, -1);
  await prisma.dayRecord.create({
    data: {
      userId,
      localDate: yesterday,
      timeZone: 'Asia/Tehran',
      meals: {
        create: [
          {
            userId,
            consumedLocalTime: '08:30',
            inputKind: 'MANUAL',
            clientRequestId: `${userId}-${yesterday}`,
            planSlotId: plan.slots[0].id,
            planOptionId: plan.slots[0].options[0].id,
            linkConfirmedByUser: true,
            items: {
              create: [
                {
                  position: 0,
                  originalName: 'egg',
                  englishLabel: 'egg',
                  quantity: 2,
                  unit: 'piece',
                  category: 'MEAT',
                },
              ],
            },
          },
        ],
      },
    },
  });
}

const paragraph =
  'Good morning. There is nothing to look back on yet, and that is fine. Your plan is not set up, ' +
  'so nothing can be compared today; you can still log what you eat and keep your totals up to date. ' +
  'One meal at a time is enough, and the day is just starting for you now.';

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reflection claim protocol', () => {
  it('twenty concurrent first visits → one row, one AI call, identical paragraphs', async () => {
    const user = await createTestUser();
    await seedYesterday(user.id, LOCAL_DATE);
    vi.mocked(generateReflection).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                data: { paragraph, usedFactIds: [] },
                attempts: [],
                usage: { promptTokens: 1, completionTokens: 1 },
                model: 'deepseek-flash',
                durationMs: 300,
              }),
            300,
          ),
        ),
    );
    const now = new Date();
    const localDate = LOCAL_DATE;

    const first = await Promise.all(
      Array.from({ length: 20 }, () => getOrCreateMessage(user.id, localDate, now)),
    );
    // Readers that arrived while the owner was generating saw GENERATING; a second
    // round (the client's poll) sees the finished paragraph.
    const second = await Promise.all(
      Array.from({ length: 20 }, () => getOrCreateMessage(user.id, localDate, now)),
    );

    expect(generateReflection).toHaveBeenCalledTimes(1);
    const rows = await prisma.morningMessage.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'READY', paragraph, isFallback: false });
    expect(first.every((c) => c.status === 'GENERATING' || c.paragraph === paragraph)).toBe(true);
    expect(first.filter((c) => c.status === 'READY').length).toBeGreaterThanOrEqual(1);
    expect(second.every((c) => c.status === 'READY' && c.paragraph === paragraph)).toBe(true);
  });

  it('a dead owner is completed with the fallback and the late provider write affects zero rows', async () => {
    const user = await createTestUser();
    await seedYesterday(user.id, LOCAL_DATE);
    const localDate = LOCAL_DATE;
    const claimedAt = new Date();
    let releaseProvider!: () => void;
    vi.mocked(generateReflection).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseProvider = () =>
            resolve({
              ok: true,
              data: { paragraph, usedFactIds: [] },
              attempts: [],
              usage: { promptTokens: 1, completionTokens: 1 },
              model: 'deepseek-flash',
              durationMs: 25_000,
            });
        }),
    );

    // The owner claims and hangs on the provider.
    const owner = getOrCreateMessage(user.id, localDate, claimedAt);
    await vi.waitFor(async () => {
      const row = await prisma.morningMessage.findUnique({
        where: { userId_localDate: { userId: user.id, localDate } },
      });
      expect(row?.status).toBe('GENERATING');
    });

    // A reader 21 s later takes over with the fallback.
    const reader = await getOrCreateMessage(
      user.id,
      localDate,
      new Date(claimedAt.getTime() + 21_000),
    );
    expect(reader).toMatchObject({ status: 'READY', isFallback: true });
    expect(reader.paragraph).not.toBe(paragraph);

    // The provider finally answers; the owner's conditional update matches nothing.
    releaseProvider();
    const late = await owner;
    const row = await prisma.morningMessage.findUnique({
      where: { userId_localDate: { userId: user.id, localDate } },
    });
    expect(row).toMatchObject({ status: 'READY', isFallback: true, paragraph: reader.paragraph });
    expect(late.paragraph).toBe(reader.paragraph);
  });

  it('a first day finishes with the static paragraph: one row, no admission, no provider call', async () => {
    const user = await createTestUser();

    const cards = await Promise.all(
      Array.from({ length: 5 }, () => getOrCreateMessage(user.id, LOCAL_DATE, new Date())),
    );

    expect(admitOperation).not.toHaveBeenCalled();
    expect(generateReflection).not.toHaveBeenCalled();
    const rows = await prisma.morningMessage.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'READY',
      isStatic: true,
      isFallback: false,
      fallbackState: 'FIRST_DAY',
      providerModel: null,
    });
    expect(rows[0].paragraph).toContain('today is day one');
    // A reader that arrived inside the claim window saw GENERATING; the next read is the static card.
    expect(cards.every((c) => c.status === 'GENERATING' || c.isStatic)).toBe(true);
    const again = await getOrCreateMessage(user.id, LOCAL_DATE, new Date());
    expect(again).toMatchObject({ status: 'READY', isStatic: true, isFallback: false });
    expect(await prisma.aiCall.count({ where: { userId: user.id } })).toBe(0);
  });
});
