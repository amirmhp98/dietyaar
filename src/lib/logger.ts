import pino from 'pino';

/**
 * Structured server logger. Pretty output in development, JSON elsewhere.
 * `pino` and `pino-pretty` are listed in `serverExternalPackages`
 * (next.config.ts) because the pretty transport runs in a worker thread that
 * the bundler cannot trace.
 *
 * Reads process.env directly (not `env`) so this module stays importable from
 * anywhere on the server, including the env module's own error path.
 */
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { env: process.env.NODE_ENV },
  redact: {
    paths: [
      '*.password',
      '*.passwordHash',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[redacted]',
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname', translateTime: 'SYS:standard' },
      }
    : undefined,
});
