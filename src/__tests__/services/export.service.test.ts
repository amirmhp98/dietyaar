import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import {
  dayRecordFactory,
  foodItemFactory,
  mealFactory,
  planFactory,
  planItemFactory,
  planOptionFactory,
  planSlotFactory,
  planTargetFactory,
  profileFactory,
  uploadFactory,
  userFactory,
} from '@/__tests__/factories';
import { buildExport } from '@/services/export.service';

resetPrismaMock();

const now = new Date('2026-09-17T10:00:00Z');

function seed() {
  prismaMock.user.findUniqueOrThrow.mockResolvedValue(
    userFactory.build({ id: 'user-1', username: 'Sara', usernameLower: 'sara' }),
  );
  prismaMock.profile.findUnique.mockResolvedValue(
    profileFactory.build({
      userId: 'user-1',
      heightCm: new Prisma.Decimal('168.5'),
      restrictions: ['peanut'],
      restrictionsOriginal: ['Peanuts'],
    }),
  );
  const slot = planSlotFactory.build({ id: 'slot-1', planId: 'plan-1' });
  const option = planOptionFactory.build({ id: 'opt-1', planSlotId: 'slot-1' });
  const item = planItemFactory.build({
    id: 'pi-1',
    planOptionId: 'opt-1',
    quantity: new Prisma.Decimal('2.5'),
  });
  prismaMock.plan.findUnique.mockResolvedValue({
    ...planFactory.build({ id: 'plan-1', userId: 'user-1', status: 'ACTIVE' }),
    slots: [{ ...slot, options: [{ ...option, items: [item] }] }],
    targets: [planTargetFactory.build({ planId: 'plan-1', low: new Prisma.Decimal('1800') })],
    notes: [],
  } as never);
  const day = dayRecordFactory.build({ localDate: '2026-09-16', timeZone: 'Asia/Tehran' });
  prismaMock.meal.findMany.mockResolvedValue([
    {
      ...mealFactory.build({ id: 'meal-1', userId: 'user-1', planSlotId: 'slot-1' }),
      day: { localDate: day.localDate, timeZone: day.timeZone, logComplete: true },
      items: [foodItemFactory.build({ mealId: 'meal-1', quantity: new Prisma.Decimal('1') })],
      uploads: [{ id: 'up-1' }],
    },
  ] as never);
  prismaMock.morningMessage.findMany.mockResolvedValue([
    {
      id: 'mm-1',
      userId: 'user-1',
      localDate: '2026-09-17',
      status: 'READY',
      paragraph: 'Yesterday went well.',
      isFallback: false,
      fallbackState: null,
      factsSnapshot: [],
      factsHash: '',
      usedFactIds: [],
      generatedAt: now,
      claimedAt: now,
      providerModel: 'deepseek-flash',
      stale: false,
      isStatic: false,
      acknowledgedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  prismaMock.upload.findMany.mockResolvedValue([
    uploadFactory.build({ id: 'up-1', userId: 'user-1', mealId: 'meal-1', status: 'ATTACHED' }),
  ]);
}

describe('buildExport', () => {
  it('produces the four documents and the photo list with no secrets', async () => {
    seed();
    const bundle = await buildExport('user-1', now);

    expect(bundle.exportedAt).toBe(now.toISOString());
    expect(bundle.timeZone).toBe('Asia/Tehran');

    expect(bundle.profile).toMatchObject({
      username: 'Sara',
      ageYears: 30,
      heightCm: 168.5,
      restrictions: ['Peanuts'],
    });
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('usernameLower');
    expect(serialized).not.toContain('$2a$12$');
    expect(bundle.profile).not.toHaveProperty('role');
    expect(bundle.profile).not.toHaveProperty('id');

    expect(bundle.plan).toMatchObject({ status: 'ACTIVE' });
    const plan = bundle.plan as { slots: Array<{ options: Array<{ items: unknown[] }> }> };
    expect(plan.slots[0]?.options[0]?.items[0]).toMatchObject({ id: 'pi-1', quantity: 2.5 });
    expect((bundle.plan as { targets: Array<{ low: number }> }).targets[0]?.low).toBe(1800);
    expect(bundle.plan).not.toHaveProperty('draftJson');
    expect(bundle.plan).not.toHaveProperty('userId');

    expect(bundle.meals[0]).toMatchObject({
      id: 'meal-1',
      date: '2026-09-16',
      timeZone: 'Asia/Tehran',
      planSlotId: 'slot-1',
      photos: ['photos/up-1.jpg'],
    });
    expect((bundle.meals[0] as { items: Array<{ quantity: number }> }).items[0]?.quantity).toBe(1);
    expect(bundle.meals[0]).not.toHaveProperty('userId');

    expect(bundle.messages).toEqual([
      {
        date: '2026-09-17',
        paragraph: 'Yesterday went well.',
        isFallback: false,
        generatedAt: now,
      },
    ]);
    expect(bundle.photos).toEqual([
      { uploadId: 'up-1', mealId: 'meal-1', storageKey: expect.any(String), bytes: 180_000 },
    ]);
  });

  it('scopes every root query by the owner and skips a pending plan', async () => {
    seed();
    prismaMock.plan.findUnique.mockResolvedValue({
      ...planFactory.build({ userId: 'user-1', status: 'DRAFT_PENDING' }),
      slots: [],
      targets: [],
      notes: [],
    } as never);
    const bundle = await buildExport('user-1', now);
    expect(bundle.plan).toBeNull();
    expect(prismaMock.meal.findMany.mock.calls[0]?.[0]?.where).toEqual({ userId: 'user-1' });
    expect(prismaMock.upload.findMany.mock.calls[0]?.[0]?.where).toEqual({
      userId: 'user-1',
      status: 'ATTACHED',
    });
    expect(prismaMock.morningMessage.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      userId: 'user-1',
    });
  });

  it('exports an account without a profile', async () => {
    seed();
    prismaMock.profile.findUnique.mockResolvedValue(null);
    const bundle = await buildExport('user-1', now);
    expect(bundle.profile).toEqual({ username: 'Sara', accountCreatedAt: expect.any(Date) });
    expect(bundle.timeZone).toBeNull();
  });
});
