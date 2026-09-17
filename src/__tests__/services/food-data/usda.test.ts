import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { env } from '@/lib/env';
import { lookupGeneric, queryKeyFor, toNutrition } from '@/services/food-data/usda';

resetPrismaMock();

const NOW = new Date('2026-09-17T10:00:00Z');
const fetchMock = vi.fn<typeof fetch>();
const mutableEnv = env as { USDA_LOOKUP_ENABLED: boolean; USDA_API_KEY?: string };

const egg = {
  fdcId: 748967,
  dataType: 'Foundation',
  publishedDate: '2020-10-30',
  foodNutrients: [
    { nutrientId: 1008, value: 143, unitName: 'KCAL' },
    { nutrientId: 1003, value: 12.4, unitName: 'G' },
    { nutrientId: 1005, value: 0.96, unitName: 'G' },
    { nutrientId: 1004, value: 9.96, unitName: 'G' },
    { nutrientId: 1093, value: 129, unitName: 'MG' },
    { nutrientId: 9999, value: 1, unitName: 'G' },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  mutableEnv.USDA_LOOKUP_ENABLED = true;
  mutableEnv.USDA_API_KEY = 'usda-key';
  prismaMock.foodDataCache.findUnique.mockResolvedValue(null);
  prismaMock.foodDataCache.upsert.mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  mutableEnv.USDA_LOOKUP_ENABLED = false;
  mutableEnv.USDA_API_KEY = undefined;
});

describe('toNutrition', () => {
  it('maps a search hit to per-100 g values with provenance', () => {
    expect(toNutrition(egg)).toEqual({
      basis: 'PER_100G',
      basisQuantity: 100,
      basisUnit: 'g',
      values: {
        ENERGY_KCAL: 143,
        PROTEIN_G: 12.4,
        CARB_G: 0.96,
        FAT_G: 9.96,
        FIBER_G: null,
        SODIUM_MG: 129,
      },
      source: 'USDA',
      sourceRef: 'usda:748967@2020-10-30',
      isEstimate: false,
      userOverride: false,
    });
    expect(toNutrition({ fdcId: 1, foodNutrients: [] })).toBeNull();
  });
});

describe('lookupGeneric', () => {
  it('returns null without a request when the flag is off', async () => {
    mutableEnv.USDA_LOOKUP_ENABLED = false;
    expect(await lookupGeneric('egg', NOW)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.foodDataCache.findUnique).not.toHaveBeenCalled();
  });

  it('searches Foundation + SR Legacy and caches the hit', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ foods: [{ fdcId: 'bad' }, egg] }), { status: 200 }),
    );
    const result = await lookupGeneric('  Egg  ', NOW);
    expect(result?.sourceRef).toBe('usda:748967@2020-10-30');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=usda-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: 'Egg',
      dataType: ['Foundation', 'SR Legacy'],
    });
    expect(prismaMock.foodDataCache.upsert).toHaveBeenCalledWith({
      where: { queryKey: queryKeyFor('Egg') },
      create: { queryKey: 'usda:egg', result: { nutrition: result }, fetchedAt: NOW },
      update: { result: { nutrition: result }, fetchedAt: NOW },
    });
  });

  it('serves a fresh cache entry (hit or miss) without a request', async () => {
    prismaMock.foodDataCache.findUnique.mockResolvedValue({
      id: 'c1',
      queryKey: 'usda:egg',
      result: { nutrition: toNutrition(egg) },
      fetchedAt: new Date('2026-09-01T00:00:00Z'),
    });
    expect((await lookupGeneric('egg', NOW))?.values.ENERGY_KCAL).toBe(143);
    prismaMock.foodDataCache.findUnique.mockResolvedValue({
      id: 'c2',
      queryKey: 'usda:sangak',
      result: { nutrition: null },
      fetchedAt: new Date('2026-09-01T00:00:00Z'),
    });
    expect(await lookupGeneric('sangak', NOW)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an entry older than 30 days', async () => {
    prismaMock.foodDataCache.findUnique.mockResolvedValue({
      id: 'c1',
      queryKey: 'usda:egg',
      result: { nutrition: toNutrition(egg) },
      fetchedAt: new Date('2026-08-01T00:00:00Z'),
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    expect(await lookupGeneric('egg', NOW)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.foodDataCache.upsert).toHaveBeenCalled();
  });

  it('returns null and caches nothing on a network or HTTP failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await lookupGeneric('rice', NOW)).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    expect(await lookupGeneric('rice', NOW)).toBeNull();
    expect(prismaMock.foodDataCache.upsert).not.toHaveBeenCalled();
  });
});
