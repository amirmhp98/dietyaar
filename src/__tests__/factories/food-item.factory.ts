import { Factory } from 'fishery';
import { Prisma, type FoodItem } from '@prisma/client';
import type { Nutrition } from '@/lib/validations/nutrition';

export const eggNutrition: Nutrition = {
  basis: 'PER_RECORDED_PORTION',
  basisQuantity: 2,
  basisUnit: 'piece',
  values: {
    ENERGY_KCAL: 140,
    PROTEIN_G: 12,
    CARB_G: 1,
    FAT_G: 10,
    FIBER_G: null,
    SODIUM_MG: null,
  },
  source: 'AI_ESTIMATE',
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
};

/** Full Prisma `FoodItem` rows (two eggs, AI-estimated). */
export const foodItemFactory = Factory.define<FoodItem>(({ sequence }) => ({
  id: `item-${sequence}`,
  mealId: 'meal-1',
  position: sequence - 1,
  originalName: 'تخم‌مرغ',
  englishLabel: 'egg',
  quantity: new Prisma.Decimal(2),
  unit: 'piece',
  quantityUnknown: false,
  quantityAssumed: false,
  preparation: null,
  category: 'OTHER',
  alternatives: [],
  matchedPlanItemId: null,
  isAddedItem: false,
  restrictionHit: null,
  nutrition: eggNutrition,
  createdAt: new Date('2026-09-17T09:00:00Z'),
  updatedAt: new Date('2026-09-17T09:00:00Z'),
}));
