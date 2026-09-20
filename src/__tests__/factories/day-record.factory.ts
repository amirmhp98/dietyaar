import { Factory } from 'fishery';
import type { DayRecord } from '@prisma/client';
import { APP_TIME_ZONE } from '@/lib/time/zone';

/** Full Prisma `DayRecord` rows (app zone, log complete by default). */
export const dayRecordFactory = Factory.define<DayRecord>(({ sequence }) => ({
  id: `day-${sequence}`,
  userId: 'user-1',
  localDate: '2026-09-17',
  timeZone: APP_TIME_ZONE,
  logComplete: true,
  createdAt: new Date('2026-09-17T08:00:00Z'),
  updatedAt: new Date('2026-09-17T08:00:00Z'),
}));
