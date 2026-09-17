import { Factory } from 'fishery';
import type { Upload } from '@prisma/client';

/** Full Prisma `Upload` rows (staged, 24 h expiry) for mocking `prisma.upload.*` results. */
export const uploadFactory = Factory.define<Upload>(({ sequence }) => ({
  id: `upload-${sequence}`,
  userId: 'user-1',
  mealId: null,
  position: null,
  storageKey: `uploads/user-1/upload-${sequence}.jpg`,
  bytes: 180_000,
  width: 1280,
  height: 960,
  sha256: 'a'.repeat(64),
  status: 'STAGED',
  expiresAt: new Date('2026-09-18T10:00:00Z'),
  createdAt: new Date('2026-09-17T10:00:00Z'),
  updatedAt: new Date('2026-09-17T10:00:00Z'),
}));
