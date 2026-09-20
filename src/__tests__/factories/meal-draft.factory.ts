import { Factory } from 'fishery';
import type { MealDraft } from '@prisma/client';
import {
  type DraftFoodItem,
  type MealDraftState,
  mealDraftStateSchema,
} from '@/lib/validations/meal';
import { eggNutrition } from './food-item.factory';

/** A draft item the way the server holds it (all defaults filled). */
export function draftItem(overrides: Partial<DraftFoodItem> & { key: string }): DraftFoodItem {
  return {
    position: 0,
    originalName: 'egg',
    englishLabel: 'egg',
    quantity: 2,
    unit: 'piece',
    unitGrams: 50,
    quantityUnknown: false,
    quantityAssumed: false,
    preparation: null,
    category: 'OTHER',
    alternatives: [],
    chosenAlternative: null,
    nutrition: eggNutrition,
    matchedPlanItemId: null,
    isAddedItem: false,
    needsReestimate: false,
    previousNutrition: null,
    scaleFlag: null,
    ...overrides,
  };
}

export function draftState(overrides: Partial<MealDraftState> = {}): MealDraftState {
  return mealDraftStateSchema.parse({
    kind: 'TEXT',
    text: 'two eggs',
    localDate: '2026-09-17',
    time: '08:30',
    items: [draftItem({ key: 'a' })],
    ...overrides,
  });
}

/** Full Prisma `MealDraft` rows (a text draft, revision 1, not analysed). */
export const mealDraftFactory = Factory.define<MealDraft>(({ sequence }) => ({
  id: `draft-${sequence}`,
  userId: 'user-1',
  clientRequestId: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
  revision: 1,
  state: draftState(),
  analysisRunId: null,
  analysisStartedRevision: null,
  analysisInputHash: null,
  analysisResult: null,
  analysisStatus: 'NONE',
  analysisFailureReason: null,
  expiresAt: new Date('2026-09-18T08:00:00Z'),
  createdAt: new Date('2026-09-17T08:00:00Z'),
  updatedAt: new Date('2026-09-17T08:00:00Z'),
}));
