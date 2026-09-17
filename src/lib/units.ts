/**
 * The regional household-unit table (product spec § 6), re-exported by
 * services/food-data/units.ts. Keys are the `unit`
 * strings stored on PlanItem / FoodItem; the AI prompts receive this table as
 * text so units resolve here rather than by guessing. Framework- and
 * Prisma-free so the rubric fixtures can use it directly.
 */
export type UnitKind = 'mass' | 'volume' | 'count';

export interface UnitDefinition {
  key: string;
  label: string;
  kind: UnitKind;
  /** Grams per one unit (mass and count-of-food units). */
  grams?: number;
  /** Millilitres per one unit (volume units). */
  ml?: number;
  source: string;
}

const T = (
  key: string,
  label: string,
  kind: UnitKind,
  amount: { grams?: number; ml?: number },
  source: string,
): UnitDefinition => ({ key, label, kind, ...amount, source });

export const UNITS: readonly UnitDefinition[] = [
  // Base units
  T('g', 'g', 'mass', { grams: 1 }, 'SI'),
  T('kg', 'kg', 'mass', { grams: 1000 }, 'SI'),
  T('ml', 'ml', 'volume', { ml: 1 }, 'SI'),
  T('l', 'l', 'volume', { ml: 1000 }, 'SI'),
  // Household volumes (product spec § 6 table)
  T('glass', 'glass', 'volume', { ml: 240 }, 'product-spec § 6: glass 240 ml'),
  T('cup', 'cup', 'volume', { ml: 200 }, 'product-spec § 6: cup 200 ml'),
  T('tsp', 'teaspoon', 'volume', { ml: 5 }, 'product-spec § 6: teaspoon 5 ml'),
  T('tbsp', 'tablespoon', 'volume', { ml: 15 }, 'product-spec § 6: tablespoon 15 ml'),
  T('bowl', 'bowl', 'volume', { ml: 350 }, 'regional default: medium bowl 350 ml'),
  // Count units with a regional default weight
  T(
    'medium_apple',
    'medium apple',
    'count',
    { grams: 180 },
    'product-spec § 6: medium apple 180 g',
  ),
  T(
    'small_banana',
    'small banana',
    'count',
    { grams: 100 },
    'product-spec § 6: small banana 100 g',
  ),
  T('medium_banana', 'medium banana', 'count', { grams: 120 }, 'regional default'),
  T('date', 'date (fruit)', 'count', { grams: 8 }, 'product-spec § 6: one date 8 g'),
  T(
    'slice_sangak',
    'slice of sangak',
    'count',
    { grams: 80 },
    'product-spec § 6: sangak slice 80 g',
  ),
  T('slice_barbari', 'slice of barbari', 'count', { grams: 70 }, 'regional default'),
  T('slice_lavash', 'sheet of lavash', 'count', { grams: 30 }, 'regional default'),
  T('slice_taftoon', 'sheet of taftoon', 'count', { grams: 60 }, 'regional default'),
  T('slice_toast', 'slice of toast', 'count', { grams: 30 }, 'regional default'),
  T('egg', 'egg', 'count', { grams: 50 }, 'regional default: medium egg 50 g'),
  T('medium_orange', 'medium orange', 'count', { grams: 150 }, 'regional default'),
  T('medium_tomato', 'medium tomato', 'count', { grams: 120 }, 'regional default'),
  T('medium_cucumber', 'medium cucumber', 'count', { grams: 100 }, 'regional default'),
  T('medium_potato', 'medium potato', 'count', { grams: 150 }, 'regional default'),
  T('walnut', 'walnut (kernel)', 'count', { grams: 4 }, 'regional default'),
  T('almond', 'almond', 'count', { grams: 1.2 }, 'regional default'),
  T(
    'skewer_kabab',
    'skewer of kabab',
    'count',
    { grams: 120 },
    'regional default: joojeh/koobideh skewer',
  ),
  T('piece', 'piece', 'count', {}, 'no default weight; portion must be estimated per food'),
  T('serving', 'serving', 'count', {}, 'no default weight; portion must be estimated per food'),
  T('handful', 'handful', 'count', { grams: 30 }, 'regional default'),
] as const;

const byKey = new Map(UNITS.map((u) => [u.key, u]));

export function unitByKey(key: string | null | undefined): UnitDefinition | undefined {
  return key ? byKey.get(key) : undefined;
}

export const UNIT_KEYS = UNITS.map((u) => u.key);

/** Labeled defaults for items written without a quantity (shown as "Assumed"). */
export const ASSUMED_DEFAULTS: Record<string, { quantity: number; unit: string; label: string }> = {
  cucumber_tomato: { quantity: 150, unit: 'g', label: 'cucumber and tomato' },
  large_salad: { quantity: 200, unit: 'g', label: 'large salad (mixed raw vegetables)' },
  small_salad: { quantity: 100, unit: 'g', label: 'small salad' },
  herbs: { quantity: 30, unit: 'g', label: 'fresh herbs (sabzi)' },
  yogurt_bowl: { quantity: 150, unit: 'g', label: 'a bowl of yogurt' },
  tea_sweet: { quantity: 240, unit: 'ml', label: 'a glass of sweetened tea' },
};

/**
 * Convert a quantity between two unit keys. Returns null when the pair is
 * unknown (mass ↔ volume without a density, count units without a weight).
 * Density is g/ml.
 */
export function convert(
  quantity: number,
  from: string,
  to: string,
  density?: number,
): number | null {
  if (from === to) return quantity;
  const a = byKey.get(from);
  const b = byKey.get(to);
  if (!a || !b) return null;

  const gramsOf = (u: UnitDefinition, q: number): number | null => {
    if (u.grams !== undefined) return q * u.grams;
    if (u.ml !== undefined && density !== undefined) return q * u.ml * density;
    return null;
  };
  const mlOf = (u: UnitDefinition, q: number): number | null => {
    if (u.ml !== undefined) return q * u.ml;
    if (u.grams !== undefined && density !== undefined) return (q * u.grams) / density;
    return null;
  };

  if (b.grams !== undefined) {
    const grams = gramsOf(a, quantity);
    return grams === null ? null : round3(grams / b.grams);
  }
  if (b.ml !== undefined) {
    const ml = mlOf(a, quantity);
    return ml === null ? null : round3(ml / b.ml);
  }
  return null;
}

/** Grams of a quantity in `unit`, or null when the unit has no mass equivalent. */
export function toGrams(quantity: number, unit: string, density?: number): number | null {
  return convert(quantity, unit, 'g', density);
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The table as text for the AI prompts. */
export function unitTableText(): string {
  return UNITS.map((u) => {
    const amount =
      u.grams !== undefined ? `${u.grams} g` : u.ml !== undefined ? `${u.ml} ml` : 'no default';
    return `${u.key}: ${u.label} = ${amount}`;
  }).join('\n');
}
