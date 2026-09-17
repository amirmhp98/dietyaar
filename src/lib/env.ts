import 'server-only';
import { z } from 'zod';

/**
 * Validated environment. Import `env` instead of touching `process.env` in
 * server code; a missing or malformed variable fails at boot with a readable
 * message instead of deep inside Prisma or bcrypt.
 *
 * `next build` also evaluates this module, so CI and Docker builds must
 * provide placeholder DATABASE_URL / DIRECT_DATABASE_URL / APP_URL values
 * (see Dockerfile and .github/workflows). Every variable is documented in
 * `.env.example`; the product ones come from tech-spec.md § 14.
 */

const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // ── App and database ────────────────────────────────────────────────
    /** Public origin, used for CSRF Origin checks and CSP. */
    APP_URL: z.url({ message: 'APP_URL must be an absolute URL' }).default('http://localhost:3000'),
    DATABASE_URL: z.url({ message: 'DATABASE_URL must be a postgresql:// connection string' }),
    /** Session-mode pooler for migrations and pg_dump; falls back to DATABASE_URL in dev. */
    DIRECT_DATABASE_URL: z.url().optional(),

    // ── Auth ────────────────────────────────────────────────────────────
    SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(90),
    /** Sign-ups per IP per hour (tech spec § 8: 10). Raised in e2e so suites stay re-runnable. */
    SIGNUP_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    /** Bypass login and run without a database. Development only. */
    SKIP_AUTH: booleanString('false'),

    // ── Logging ─────────────────────────────────────────────────────────
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    PRISMA_LOG_QUERIES: booleanString('false'),

    // ── Photo storage (Supabase Storage through S3). All or none. ───────
    S3_ENDPOINT: optionalString,
    S3_REGION: optionalString,
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_KEY_PREFIX: z.string().default(''),
    STORAGE_SOFT_LIMIT_BYTES: z.coerce.number().int().positive().default(734_003_200),

    // ── Backups (Hamravesh Object Storage). Required in production. ─────
    BACKUP_S3_ENDPOINT: optionalString,
    BACKUP_S3_REGION: optionalString,
    BACKUP_S3_BUCKET: optionalString,
    BACKUP_S3_ACCESS_KEY_ID: optionalString,
    BACKUP_S3_SECRET_ACCESS_KEY: optionalString,
    BACKUP_ENABLED: booleanString('true'),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
    BACKUP_ENCRYPTION_KEY: optionalString,

    // ── AI provider ─────────────────────────────────────────────────────
    /** Absent in dev/test → every AI operation returns AI_UNAVAILABLE. */
    DEEPSEEK_API_KEY: optionalString,
    DEEPSEEK_API_BASE_URL: z.url().default('https://api.deepseek.com'),
    AI_MODEL_TEXT: z.string().default('deepseek-flash'),
    AI_MODEL_VISION: z.string().default('deepseek-flash'),
    AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(5_000_000),

    // ── Feature flags (decision 015: env vars, not a table) ─────────────
    PHOTO_LOGGING_ENABLED: booleanString('false'),
    USDA_LOOKUP_ENABLED: booleanString('false'),
    USDA_API_KEY: optionalString,
    SCHEDULER_ENABLED: booleanString('true'),

    // ── Observability ───────────────────────────────────────────────────
    SENTRY_DSN: optionalString,
  })
  .superRefine((value, ctx) => {
    const s3 = [
      value.S3_ENDPOINT,
      value.S3_REGION,
      value.S3_BUCKET,
      value.S3_ACCESS_KEY_ID,
      value.S3_SECRET_ACCESS_KEY,
    ];
    const set = s3.filter(Boolean).length;
    if (set !== 0 && set !== s3.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_ENDPOINT'],
        message:
          'S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together',
      });
    }
  });

export type Env = z.infer<typeof schema> & { DIRECT_DATABASE_URL: string };

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}\nSee .env.example.`);
  }
  if (parsed.data.SKIP_AUTH && parsed.data.NODE_ENV === 'production') {
    throw new Error('SKIP_AUTH=true is not allowed when NODE_ENV=production.');
  }
  return {
    ...parsed.data,
    DIRECT_DATABASE_URL: parsed.data.DIRECT_DATABASE_URL ?? parsed.data.DATABASE_URL,
  };
}

export const env = loadEnv();

/** True when the photo bucket is configured (all five S3_* variables). */
export const storageConfigured = Boolean(env.S3_ENDPOINT);
