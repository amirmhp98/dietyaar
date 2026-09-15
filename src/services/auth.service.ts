import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/lib/env';
import { ServiceError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/t';
import type { AuthUser } from '@/types/auth';

/**
 * Authentication service: credentials, session tokens, password hashing,
 * login throttling. Framework-free — no `next/*`, no cookies. Callers
 * (actions, lib/auth) own the HTTP side. Everything here is unit-testable
 * with a mocked Prisma client.
 */

const BCRYPT_ROUNDS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fields safe to expose to the client. */
export const AUTH_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
} as const;

/**
 * Compared against when the username does not exist, so an unknown user costs
 * the same bcrypt work as a wrong password (no user enumeration via timing).
 */
const dummyHash = bcrypt.hash('unknown-user-placeholder', BCRYPT_ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Only the SHA-256 of the raw token is stored; a leaked DB cannot forge cookies. */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// ─── Login throttling ────────────────────────────────────────────────────
// Per-username sliding window kept in process memory. Good enough for a single
// instance; swap `attemptStore` for Redis/DB when running several replicas.

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; firstAt: number };
const attemptStore = new Map<string, AttemptRecord>();

function attemptsFor(username: string, now: number): AttemptRecord {
  const record = attemptStore.get(username);
  if (!record || now - record.firstAt > LOGIN_WINDOW_MS) return { count: 0, firstAt: now };
  return record;
}

/** Throws `ServiceError('TOO_MANY_ATTEMPTS')` while the username is locked out. */
export function assertLoginAllowed(username: string, now = Date.now()): void {
  const record = attemptsFor(username, now);
  if (record.count < LOGIN_MAX_ATTEMPTS) return;
  const minutes = Math.max(1, Math.ceil((record.firstAt + LOGIN_WINDOW_MS - now) / 60_000));
  throw new ServiceError(t('auth.errors.tooManyAttempts', { minutes }), 'TOO_MANY_ATTEMPTS');
}

export function recordLoginFailure(username: string, now = Date.now()): void {
  const record = attemptsFor(username, now);
  attemptStore.set(username, { count: record.count + 1, firstAt: record.firstAt });
}

export function clearLoginFailures(username: string): void {
  attemptStore.delete(username);
}

/** Test hook. */
export function resetLoginThrottle(): void {
  attemptStore.clear();
}

// ─── Sessions ────────────────────────────────────────────────────────────

export type AuthenticateResult = {
  user: AuthUser;
  /** Raw token for the cookie. Never persisted. */
  token: string;
  expiresAt: Date;
};

/**
 * Verify credentials and open a session. Returns null on bad credentials or an
 * inactive user (same outcome for both, so nothing is leaked). Throws
 * `ServiceError('TOO_MANY_ATTEMPTS')` when the username is throttled.
 */
export async function authenticate(
  username: string,
  password: string,
): Promise<AuthenticateResult | null> {
  assertLoginAllowed(username);

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordHash = user?.passwordHash ?? (await dummyHash);
  const valid = await bcrypt.compare(password, passwordHash);
  if (!user || !valid || !user.isActive) {
    recordLoginFailure(username);
    return null;
  }
  clearLoginFailures(username);

  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SESSION_MAX_AGE_DAYS * DAY_MS);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } }),
    prisma.session.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
  ]);

  const { id, fullName, role, isActive } = user;
  return { user: { id, username: user.username, fullName, role, isActive }, token, expiresAt };
}

/** Resolve a raw cookie token to its user, or null if missing, expired or deactivated. */
export async function findUserBySessionToken(rawToken: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    include: { user: { select: AUTH_USER_SELECT } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  return session.user;
}

export async function revokeSession(rawToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(rawToken) } });
}

/** Log a user out everywhere (deactivation, password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
