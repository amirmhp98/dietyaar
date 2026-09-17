import type { Prisma } from '@prisma/client';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  EMPTY_VALUES,
  nutritionSchema,
  type Nutrition,
  type NutritionValues,
} from '@/lib/validations/nutrition';

/**
 * USDA FoodData Central secondary lookup (tech spec § 10.6, product spec
 * § 13): generic ingredients only (Foundation + SR Legacy), values per 100 g,
 * cached in `FoodDataCache` for 30 days including misses. Behind
 * `USDA_LOOKUP_ENABLED`; any network or shape problem yields null.
 */
export const USDA_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
export const USDA_CACHE_DAYS = 30;
export const USDA_TIMEOUT_MS = 5_000;

/** Cache row shape; a miss is stored as `{ nutrition: null }` (Prisma Json cannot hold a bare null). */
const cacheEntrySchema = z.object({ nutrition: nutritionSchema.nullable() });

/** FoodData Central nutrient ids → our keys. */
const NUTRIENT_IDS: Record<number, keyof NutritionValues> = {
  1008: 'ENERGY_KCAL',
  1003: 'PROTEIN_G',
  1005: 'CARB_G',
  1004: 'FAT_G',
  1079: 'FIBER_G',
  1093: 'SODIUM_MG',
};

interface SearchFood {
  fdcId?: unknown;
  dataType?: unknown;
  publishedDate?: unknown;
  foodNutrients?: Array<{ nutrientId?: unknown; value?: unknown; unitName?: unknown }>;
}

export function queryKeyFor(englishLabel: string): string {
  return `usda:${englishLabel.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/** Maps one search hit to a per-100 g Nutrition, or null when it has no energy value. */
export function toNutrition(food: SearchFood): Nutrition | null {
  if (typeof food.fdcId !== 'number') return null;
  const values: NutritionValues = { ...EMPTY_VALUES };
  for (const n of food.foodNutrients ?? []) {
    const key = typeof n.nutrientId === 'number' ? NUTRIENT_IDS[n.nutrientId] : undefined;
    if (!key || typeof n.value !== 'number' || !Number.isFinite(n.value) || n.value < 0) continue;
    // Energy is listed in kcal and kJ under different ids; 1008 is kcal.
    values[key] = n.value;
  }
  if (values.ENERGY_KCAL === null) return null;
  const version = typeof food.publishedDate === 'string' ? food.publishedDate : 'unknown';
  return {
    basis: 'PER_100G',
    basisQuantity: 100,
    basisUnit: 'g',
    values,
    source: 'USDA',
    sourceRef: `usda:${food.fdcId}@${version}`,
    isEstimate: false,
    userOverride: false,
  };
}

async function search(englishLabel: string): Promise<Nutrition | null> {
  const url = `${USDA_API_BASE_URL}/foods/search?api_key=${encodeURIComponent(env.USDA_API_KEY ?? '')}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: englishLabel,
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 5,
      pageNumber: 1,
    }),
    signal: AbortSignal.timeout(USDA_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`USDA search failed with ${response.status}`);
  const body = (await response.json()) as { foods?: SearchFood[] };
  for (const food of body.foods ?? []) {
    const nutrition = toNutrition(food);
    if (nutrition) return nutrition;
  }
  return null;
}

/**
 * Per-100 g values for a generic English food label, or null when disabled,
 * unknown to USDA, or unreachable. Cached hits and misses are reused for 30 days.
 */
export async function lookupGeneric(
  englishLabel: string,
  now: Date = new Date(),
): Promise<Nutrition | null> {
  if (!env.USDA_LOOKUP_ENABLED || !env.USDA_API_KEY) return null;
  const label = englishLabel.trim();
  if (label === '') return null;
  const queryKey = queryKeyFor(label);
  const freshAfter = new Date(now.getTime() - USDA_CACHE_DAYS * 24 * 60 * 60 * 1000);

  const cached = await prisma.foodDataCache.findUnique({ where: { queryKey } });
  if (cached && cached.fetchedAt >= freshAfter) {
    const parsed = cacheEntrySchema.safeParse(cached.result);
    if (parsed.success) return parsed.data.nutrition;
  }

  let result: Nutrition | null;
  try {
    result = await search(label);
  } catch (err) {
    logger.warn({ err, queryKey }, 'USDA lookup failed');
    return null;
  }
  const stored = { nutrition: result } as unknown as Prisma.InputJsonValue;
  await prisma.foodDataCache.upsert({
    where: { queryKey },
    create: { queryKey, result: stored, fetchedAt: now },
    update: { result: stored, fetchedAt: now },
  });
  return result;
}
