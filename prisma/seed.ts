import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Idempotent seed: creates the first admin if it does not exist.
 * Run with `npm run db:seed` (Prisma passes DATABASE_URL through).
 * Override credentials with SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD.
 */
const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, fullName: 'مدیر سیستم', role: 'ADMIN', isActive: true },
  });

  console.log(`Admin user ready: ${admin.username} (${admin.id})`);
  if (password === 'admin123') {
    console.warn(
      'Default password in use. Change it after first login (Admin → Users → reset password).',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
