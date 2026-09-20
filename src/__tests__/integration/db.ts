import { prisma } from '@/lib/prisma';

/** Wipe every product table between tests (cascades handle the children). */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "job_locks", "food_data_cache", "analytics_events" CASCADE',
  );
}

let counter = 0;

/** A fresh onboarded user with a profile. */
export async function createTestUser() {
  counter += 1;
  const username = `it_user_${Date.now()}_${counter}`;
  return prisma.user.create({
    data: {
      username,
      usernameLower: username.toLowerCase(),
      passwordHash: 'x',
      onboardingStep: 'DONE',
      profile: {
        create: {
          ageYears: 30,
          sex: 'MALE',
          heightCm: 175,
          weightKg: 70,
          completedAt: new Date(),
        },
      },
    },
    include: { profile: true },
  });
}
