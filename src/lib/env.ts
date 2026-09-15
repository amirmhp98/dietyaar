import 'server-only';
import { z } from 'zod';

/**
 * Validated environment. Import `env` instead of touching `process.env` in
 * server code; a missing or malformed variable fails at boot with a readable
 * message instead of deep inside Prisma or bcrypt.
 *
 * `next build` also evaluates this module, so CI and Docker builds must
 * provide a placeholder DATABASE_URL (see Dockerfile and .github/workflows).
 */

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ message: 'DATABASE_URL must be a postgresql:// connection string' }),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
  /** Bypass login and run without a database. Development only. */
  SKIP_AUTH: booleanString,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PRISMA_LOG_QUERIES: booleanString,
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}\nSee .env.example.`);
  }
  if (parsed.data.SKIP_AUTH && parsed.data.NODE_ENV === 'production') {
    throw new Error('SKIP_AUTH=true is not allowed when NODE_ENV=production.');
  }
  return parsed.data;
}

export const env = loadEnv();
