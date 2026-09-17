import bcrypt from 'bcryptjs';
import { isCommonPassword } from '@/lib/common-passwords';
import { ServiceError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/t';
import type { SignUpInput } from '@/lib/validations/account';
import {
  type AuthenticateResult,
  hashPassword,
  normalizeUsername,
  openSession,
  revokeAllSessions,
  revokeOtherSessions,
  toAuthUser,
} from '@/services/auth.service';

/**
 * Account module (tech spec § 4): sign-up, password change, deletion. No
 * recovery path of any kind exists (decision 008).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const DELETION_GRACE_DAYS = 7;

export function assertNotCommon(password: string): void {
  if (isCommonPassword(password)) {
    throw new ServiceError(t('validation.passwordCommon'), 'PASSWORD_COMMON');
  }
}

/** Creates the account and opens its first session. */
export async function signUp(input: SignUpInput): Promise<AuthenticateResult> {
  assertNotCommon(input.password);
  const usernameLower = normalizeUsername(input.username);
  const taken = await prisma.user.findUnique({ where: { usernameLower }, select: { id: true } });
  if (taken) throw new ServiceError(t('signup.errors.usernameTaken'), 'USERNAME_TAKEN');

  const user = await prisma.user.create({
    data: {
      username: input.username.trim(),
      usernameLower,
      passwordHash: await hashPassword(input.password),
      fullName: null,
      role: 'USER',
      onboardingStep: 'AGE',
    },
  });
  return openSession(toAuthUser(user));
}

/** Verifies the current password, sets the new one and signs out every other device. */
export async function changePassword(
  ownerId: string,
  currentPassword: string,
  nextPassword: string,
  currentRawToken: string,
): Promise<void> {
  assertNotCommon(nextPassword);
  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new ServiceError(t('settings.account.wrongPassword'), 'INVALID_PASSWORD');
  await prisma.user.update({
    where: { id: ownerId },
    data: { passwordHash: await hashPassword(nextPassword) },
  });
  await revokeOtherSessions(ownerId, currentRawToken);
}

/**
 * Deletion (product spec § 15): typed confirmation, immediate loss of access,
 * pending AI jobs cancelled, purge after seven days by the hourly task.
 */
export async function requestDeletion(
  ownerId: string,
  typedUsername: string,
  now = new Date(),
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  if (normalizeUsername(typedUsername) !== user.usernameLower) {
    throw new ServiceError(t('settings.privacy.deleteMismatch'), 'CONFIRMATION_MISMATCH');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: ownerId },
      data: {
        isActive: false,
        deletionRequestedAt: now,
        deletionScheduledFor: new Date(now.getTime() + DELETION_GRACE_DAYS * DAY_MS),
      },
    }),
    prisma.planImportJob.updateMany({
      where: { userId: ownerId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED', finishedAt: now },
    }),
  ]);
  await revokeAllSessions(ownerId);
}

/** Under-18 stop: only while no Profile row exists (tech spec § 21.15). */
export async function deleteUnderageAccount(ownerId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    include: { profile: { select: { id: true } } },
  });
  if (!user) throw new ServiceError(t('errors.notFound'), 'NOT_FOUND');
  if (user.onboardingStep !== 'AGE' || user.profile) {
    throw new ServiceError(t('errors.unexpected'), 'NOT_ALLOWED');
  }
  await prisma.user.delete({ where: { id: ownerId } });
}
