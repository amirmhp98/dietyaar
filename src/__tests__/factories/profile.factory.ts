import { Factory } from 'fishery';
import { Prisma, type Profile } from '@prisma/client';

/** Full Prisma `Profile` rows (onboarded, metric, Tehran). */
export const profileFactory = Factory.define<Profile>(({ sequence }) => ({
  id: `profile-${sequence}`,
  userId: `user-${sequence}`,
  ageYears: 30,
  sex: 'FEMALE',
  heightCm: new Prisma.Decimal(168),
  weightKg: new Prisma.Decimal(64),
  weightMeasuredAt: '2026-09-10',
  timeZone: 'Asia/Tehran',
  unitSystem: 'METRIC',
  weekStart: 6,
  appearance: 'SYSTEM',
  displayName: null,
  goal: null,
  restrictions: [],
  restrictionsOriginal: [],
  aiNoticePlanShownAt: null,
  aiNoticeMealTextShownAt: null,
  aiNoticePhotoShownAt: null,
  lastSeenDeviceTimeZone: null,
  timeZoneHintDismissedAt: null,
  completedAt: new Date('2026-09-10T00:00:00Z'),
  createdAt: new Date('2026-09-10T00:00:00Z'),
  updatedAt: new Date('2026-09-10T00:00:00Z'),
}));
