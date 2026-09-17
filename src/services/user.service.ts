import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';
import type { CreateUserInput, UpdateUserInput } from '@/lib/validations/user';
import { hashPassword, normalizeUsername, revokeAllSessions } from '@/services/auth.service';

/**
 * User management service — the reference module every other module copies.
 * Rules of the layer: no `next/*`, no React, throw `ServiceError` for
 * expected failures, let unexpected errors propagate. Inputs arrive already
 * validated by the zod schemas in `lib/validations/user.ts`.
 */

export const USER_LIST_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { sessions: true } },
} satisfies Prisma.UserSelect;

export type UserListItem = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>;

export function listUsers(): Promise<UserListItem[]> {
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: USER_LIST_SELECT });
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const usernameLower = normalizeUsername(input.username);
  const taken = await prisma.user.findUnique({ where: { usernameLower } });
  if (taken) throw new ServiceError(t('users.errors.usernameTaken'), 'USERNAME_TAKEN');

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      username: input.username,
      usernameLower,
      passwordHash,
      fullName: input.fullName || null,
      role: input.role,
    },
    select: USER_LIST_SELECT,
  });
}

/** `actorId` is the admin performing the change; admins cannot change their own role. */
export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  actorId: string,
): Promise<UserListItem> {
  const user = await requireUser(userId);
  if (userId === actorId && input.role !== user.role) {
    throw new ServiceError(t('users.errors.cannotChangeOwnRole'), 'SELF_ROLE_CHANGE');
  }
  return prisma.user.update({ where: { id: userId }, data: input, select: USER_LIST_SELECT });
}

/** Deactivating also logs the user out of every session. Admins cannot deactivate themselves. */
export async function setUserActive(
  userId: string,
  isActive: boolean,
  actorId: string,
): Promise<UserListItem> {
  if (!isActive && userId === actorId) {
    throw new ServiceError(t('users.errors.cannotDeactivateSelf'), 'SELF_DEACTIVATE');
  }
  await requireUser(userId);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: USER_LIST_SELECT,
  });
  if (!isActive) await revokeAllSessions(userId);
  return updated;
}

/** Sets a new password and logs the user out everywhere so they must sign in again. */
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  await requireUser(userId);
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllSessions(userId);
}

async function requireUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ServiceError(t('users.errors.notFound'), 'USER_NOT_FOUND');
  return user;
}
