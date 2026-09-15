import type { UserRole } from '@prisma/client';

/** The safe, client-shareable projection of a user. Never includes passwordHash. */
export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};
