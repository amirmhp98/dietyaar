import { Factory } from 'fishery';
import type { DayRecord } from '@prisma/client';

/** Full Prisma `DayRecord` rows (Tehran, log complete by default). */
export const dayRecordFactory = Factory.define<DayRecord>(({ sequence }) => ({
  id: `day-${sequence}`,
  userId: 'user-1',
  localDate: '2026-09-17',
  timeZone: 'Asia/Tehran',
  logComplete: true,
  createdAt: new Date('2026-09-17T08:00:00Z'),
  updatedAt: new Date('2026-09-17T08:00:00Z'),
}));
