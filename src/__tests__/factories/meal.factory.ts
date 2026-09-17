import { Factory } from 'fishery';
import type { Meal } from '@prisma/client';

/** Full Prisma `Meal` rows (a text meal under "Other", revision 1). */
export const mealFactory = Factory.define<Meal>(({ sequence }) => ({
  id: `meal-${sequence}`,
  userId: 'user-1',
  dayRecordId: 'day-1',
  consumedLocalTime: '12:30',
  inputKind: 'TEXT',
  originalText: 'two eggs and toast',
  notes: null,
  revision: 1,
  copiedFromMealId: null,
  clientRequestId: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
  planSlotId: null,
  planOptionId: null,
  linkConfirmedByUser: false,
  createdAt: new Date('2026-09-17T09:00:00Z'),
  updatedAt: new Date('2026-09-17T09:00:00Z'),
}));
