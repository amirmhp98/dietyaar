import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Idempotent seed: creates the first admin if it does not exist, and outside
 * production an onboarded `demo` user the e2e specs sign in as.
 * Run with `npm run db:seed` (Prisma passes DATABASE_URL through).
 * Override credentials with SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD.
 */
const prisma = new PrismaClient();

const normalizeUsername = (username: string) => username.trim().toLowerCase();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { usernameLower: normalizeUsername(username) },
    update: {},
    create: {
      username,
      usernameLower: normalizeUsername(username),
      passwordHash,
      fullName: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`Admin user ready: ${admin.username} (${admin.id})`);

  // Outside production the admin is onboarded too, so the ops e2e specs can sign in
  // and open /admin/users without walking through onboarding first.
  if (process.env.NODE_ENV !== 'production') {
    await prisma.user.update({ where: { id: admin.id }, data: { onboardingStep: 'DONE' } });
    await prisma.profile.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        ageYears: 35,
        sex: 'MALE',
        heightCm: 178,
        weightKg: 76,
        weightMeasuredAt: new Date().toISOString().slice(0, 10),
        timeZone: 'Asia/Tehran',
        completedAt: new Date(),
      },
    });
  }
  if (password === 'admin123') {
    console.warn(
      'Default password in use. Change it after first login (Admin → Users → reset password).',
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    const demoHash = await bcrypt.hash('demo1234', 12);
    const demo = await prisma.user.upsert({
      where: { usernameLower: 'demo' },
      update: {},
      create: {
        username: 'demo',
        usernameLower: 'demo',
        passwordHash: demoHash,
        role: 'USER',
        isActive: true,
        onboardingStep: 'DONE',
        profile: {
          create: {
            ageYears: 30,
            sex: 'FEMALE',
            heightCm: 168,
            weightKg: 64,
            weightMeasuredAt: new Date().toISOString().slice(0, 10),
            timeZone: 'Asia/Tehran',
            unitSystem: 'METRIC',
            displayName: 'Demo',
            completedAt: new Date(),
          },
        },
      },
    });
    console.log(`Demo user ready: ${demo.username} / demo1234`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
