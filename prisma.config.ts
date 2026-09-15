import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Prisma CLI configuration (replaces the deprecated `package.json#prisma` block). */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
