import { formatNumber } from '@/lib/format';
import { t, tp } from '@/lib/t';

/**
 * Units are measures (product spec § 6, decision 024), re-exported by
 * services/food-data/units.ts. Keys are the `unit` strings stored on
 * PlanItem / FoodItem; the AI prompts receive this table as text so units
 * resolve here rather than by guessing. A count unit ("2 × apple", "1 slice
 * of sangak") carries no weight of its own: the grams of one unit are an
 * attribute of the item (`unitGrams`), estimated by the AI from the food
 * weight hints below, so a pear or a slice of any bread works without a table
 * entry. Framework- and Prisma-free so the rubric fixtures can use it.
 */
export type UnitKind = 'mass' | 'volume' | 'count';

export interface UnitDefinition {
  key: string;
  kind: UnitKind;
  /** Grams per one unit (mass units). */
  grams?: number;
  /** Millilitres per one unit (volume units). */
  ml?: number;
  source: string;
}

const T = <K extends string>(
  key: K,
  kind: UnitKind,
  amount: { grams?: number; ml?: number },
  source: string,
) => ({ key, kind, ...amount, source });

export const UNITS = [
  // Base units
  T('g', 'mass', { grams: 1 }, 'SI'),
  T('kg', 'mass', { grams: 1000 }, 'SI'),
  T('ml', 'volume', { ml: 1 }, 'SI'),
  T('l', 'volume', { ml: 1000 }, 'SI'),
  // Household volumes (product spec § 6 table)
  T('glass', 'volume', { ml: 240 }, 'product-spec § 6: glass 240 ml'),
  T('cup', 'volume', { ml: 200 }, 'product-spec § 6: cup 200 ml'),
  T('tsp', 'volume', { ml: 5 }, 'product-spec § 6: teaspoon 5 ml'),
  T('tbsp', 'volume', { ml: 15 }, 'product-spec § 6: tablespoon 15 ml'),
  T('bowl', 'volume', { ml: 350 }, 'regional default: medium bowl 350 ml'),
  // Count units: the weight of one is the item's `unitGrams` (decision 024)
  T('piece', 'count', {}, 'count of the item; grams per piece on the item'),
  T('slice', 'count', {}, 'count of slices; grams per slice on the item'),
  T('sheet', 'count', {}, 'count of sheets (lavash, taftoon); grams per sheet on the item'),
  T('skewer', 'count', {}, 'count of skewers; grams per skewer on the item'),
  T('handful', 'count', {}, 'count of handfuls; grams per handful on the item'),
  T('serving', 'count', {}, 'count of servings; grams per serving on the item'),
] as const satisfies readonly UnitDefinition[];

export type UnitKey = (typeof UNITS)[number]['key'];

const byKey = new Map<string, UnitDefinition>(UNITS.map((u) => [u.key, u]));

export function unitByKey(key: string | null | undefined): UnitDefinition | undefined {
  return key ? byKey.get(key) : undefined;
}

export function isUnitKey(key: string | null | undefined): key is UnitKey {
  return key !== null && key !== undefined && byKey.has(key);
}

/** True for a count unit ("piece", "slice", …): the amount is a number of items, not a measure. */
export function isCountUnit(key: string | null | undefined): boolean {
  return unitByKey(key)?.kind === 'count';
}

/**
 * Typical weights of one piece / slice / sheet / skewer / handful of common
 * foods. The AI reads this table when it fills `unitGrams`; the app never
 * looks a food up here itself (the size the user wrote stays in the name and
 * the model adjusts the estimate to it).
 */
export interface FoodWeightHint {
  label: string;
  grams: number;
  source: string;
}

const H = (label: string, grams: number, source: string): FoodWeightHint => ({
  label,
  grams,
  source,
});

export const FOOD_WEIGHT_HINTS: readonly FoodWeightHint[] = [
  H('medium apple', 180, 'product-spec § 6: medium apple 180 g'),
  H('small banana', 100, 'product-spec § 6: small banana 100 g'),
  H('medium banana', 120, 'regional default'),
  H('date (fruit)', 8, 'product-spec § 6: one date 8 g'),
  H('slice of sangak', 80, 'product-spec § 6: sangak slice 80 g'),
  H('slice of barbari', 70, 'regional default'),
  H('sheet of lavash', 30, 'regional default'),
  H('sheet of taftoon', 60, 'regional default'),
  H('slice of toast', 30, 'regional default'),
  H('egg', 50, 'regional default: medium egg 50 g'),
  H('medium orange', 150, 'regional default'),
  H('medium tomato', 120, 'regional default'),
  H('medium cucumber', 100, 'regional default'),
  H('medium potato', 150, 'regional default'),
  H('walnut kernel', 4, 'regional default'),
  H('almond', 1.2, 'regional default'),
  H('kabab skewer', 120, 'regional default: joojeh/koobideh skewer'),
  H('handful of nuts', 30, 'regional default'),
] as const;

/** The hint table as text for the AI prompts. */
export function foodWeightHintsText(): string {
  return FOOD_WEIGHT_HINTS.map((h) => `${h.label} ≈ ${h.grams} g`).join('; ');
}

/**
 * Unit keys of the pre-024 table (a food and a size baked into the unit).
 * A pending draft may still hold one; `legacyUnit` maps it to a measure plus
 * the grams of one unit so the draft opens unchanged. The migration
 * `count_units` applies the same mapping to the stored rows.
 */
const LEGACY_UNITS: Record<string, { unit: UnitKey; unitGrams: number }> = {
  medium_apple: { unit: 'piece', unitGrams: 180 },
  small_banana: { unit: 'piece', unitGrams: 100 },
  medium_banana: { unit: 'piece', unitGrams: 120 },
  date: { unit: 'piece', unitGrams: 8 },
  egg: { unit: 'piece', unitGrams: 50 },
  medium_orange: { unit: 'piece', unitGrams: 150 },
  medium_tomato: { unit: 'piece', unitGrams: 120 },
  medium_cucumber: { unit: 'piece', unitGrams: 100 },
  medium_potato: { unit: 'piece', unitGrams: 150 },
  walnut: { unit: 'piece', unitGrams: 4 },
  almond: { unit: 'piece', unitGrams: 1.2 },
  slice_sangak: { unit: 'slice', unitGrams: 80 },
  slice_barbari: { unit: 'slice', unitGrams: 70 },
  slice_toast: { unit: 'slice', unitGrams: 30 },
  slice_lavash: { unit: 'sheet', unitGrams: 30 },
  slice_taftoon: { unit: 'sheet', unitGrams: 60 },
  skewer_kabab: { unit: 'skewer', unitGrams: 120 },
};

export function legacyUnit(key: string | null | undefined): {
  unit: UnitKey;
  unitGrams: number;
} | null {
  return key ? (LEGACY_UNITS[key] ?? null) : null;
}

/**
 * Zod `preprocess` for item shapes: an old unit key becomes its measure and,
 * unless the item already carries one, the grams of one unit. `handful` kept
 * its key but lost its default weight, so an old handful gets 30 g each.
 */
export function withLegacyUnit(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const item = raw as { unit?: unknown; unitGrams?: unknown };
  if (typeof item.unit !== 'string') return raw;
  const legacy =
    legacyUnit(item.unit) ??
    (item.unit === 'handful' && (item.unitGrams === null || item.unitGrams === undefined)
      ? { unit: 'handful' as const, unitGrams: 30 }
      : null);
  if (!legacy) return raw;
  return {
    ...item,
    unit: legacy.unit,
    unitGrams:
      typeof item.unitGrams === 'number' && item.unitGrams > 0 ? item.unitGrams : legacy.unitGrams,
  };
}

/**
 * The grams per unit an item carries after an estimate: its own when it has
 * one, the model's for a count unit without one, null for a measure.
 */
export function resolveUnitGrams(
  unit: string | null | undefined,
  current: number | null | undefined,
  estimated: number | null | undefined,
): number | null {
  if (!isCountUnit(unit)) return null;
  return current ?? estimated ?? null;
}

/** Labeled defaults for items written without a quantity (shown as "Assumed"). */
export const ASSUMED_DEFAULTS: Record<string, { quantity: number; unit: string; label: string }> = {
  cucumber_tomato: { quantity: 150, unit: 'g', label: 'cucumber and tomato' },
  large_salad: { quantity: 200, unit: 'g', label: 'large salad (mixed raw vegetables)' },
  small_salad: { quantity: 100, unit: 'g', label: 'small salad' },
  herbs: { quantity: 30, unit: 'g', label: 'fresh herbs (sabzi)' },
  yogurt_bowl: { quantity: 150, unit: 'g', label: 'a bowl of yogurt' },
  tea_sweet: { quantity: 240, unit: 'ml', label: 'a glass of sweetened tea' },
};

export interface ConversionContext {
  /** Grams of one unit when the count side of the conversion is a count unit. */
  unitGrams?: number | null;
  /** g/ml, for mass ↔ volume. */
  density?: number;
}

function gramsOf(u: UnitDefinition, q: number, ctx: ConversionContext): number | null {
  if (u.grams !== undefined) return q * u.grams;
  if (u.kind === 'count') {
    return ctx.unitGrams !== null && ctx.unitGrams !== undefined && ctx.unitGrams > 0
      ? q * ctx.unitGrams
      : null;
  }
  if (u.ml !== undefined && ctx.density !== undefined) return q * u.ml * ctx.density;
  return null;
}

function mlOf(u: UnitDefinition, q: number, ctx: ConversionContext): number | null {
  if (u.ml !== undefined) return q * u.ml;
  if (ctx.density === undefined) return null;
  const grams = gramsOf(u, q, ctx);
  return grams === null ? null : grams / ctx.density;
}

/**
 * Convert a quantity between two unit keys. Returns null when the pair is
 * unknown: mass ↔ volume without a density, a count unit without
 * `unitGrams`, two different count units, or an unknown key.
 */
export function convert(
  quantity: number,
  from: string,
  to: string,
  ctx: ConversionContext = {},
): number | null {
  if (from === to) return quantity;
  const a = byKey.get(from);
  const b = byKey.get(to);
  if (!a || !b) return null;
  if (a.kind === 'count' && b.kind === 'count') return null;

  if (b.grams !== undefined) {
    const grams = gramsOf(a, quantity, ctx);
    return grams === null ? null : round3(grams / b.grams);
  }
  if (b.ml !== undefined) {
    const ml = mlOf(a, quantity, ctx);
    return ml === null ? null : round3(ml / b.ml);
  }
  // Into a count unit: grams of the source divided by the grams of one unit.
  const grams = gramsOf(a, quantity, { density: ctx.density });
  const each = ctx.unitGrams;
  if (grams === null || each === null || each === undefined || each <= 0) return null;
  return round3(grams / each);
}

/** Grams of a quantity in `unit`, or null when the unit has no mass equivalent. */
export function toGrams(
  quantity: number,
  unit: string,
  ctx: ConversionContext = {},
): number | null {
  return convert(quantity, unit, 'g', ctx);
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Rendering ─────────────────────────────────────────────────────────────

/** The unit's short label for a select ("g", "slice"); a free-text unit is shown as written. */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return isUnitKey(unit) ? t(`unit.label.${unit}`) : unit;
}

/**
 * The amount as the UI writes it before the name: "150 g", "1 glass",
 * "2 tbsp"; for count units "2 ×" (the name follows), "2 slices",
 * "1 skewer", "3 handfuls". Plurals come from the dictionary through `tp()`.
 */
export function formatAmount(quantity: number, unit: string | null | undefined): string {
  const amount = formatNumber(quantity, { maximumFractionDigits: 2 });
  if (!unit) return amount;
  if (isUnitKey(unit)) return tp(`unit.${unit}`, quantity, { amount });
  return `${amount} ${unit}`;
}

/**
 * An amount inside a portion sentence that already names the item ("سیب:
 * more than planned (3 instead of 2)"): pieces are bare numbers, since
 * "3 × instead of 2 ×" reads badly; every other unit keeps its word.
 */
export function portionAmount(quantity: number, unit: string | null | undefined): string {
  return unit === 'piece'
    ? formatNumber(quantity, { maximumFractionDigits: 2 })
    : formatAmount(quantity, unit);
}

/** The table as text for the AI prompts. */
export function unitTableText(): string {
  const byKind = (kind: UnitKind) => UNITS.filter((u) => u.kind === kind);
  const measure = (u: UnitDefinition) =>
    u.grams !== undefined ? `${u.key} (${u.grams} g)` : `${u.key} (${u.ml} ml)`;
  return [
    `mass: ${byKind('mass').map(measure).join(', ')}`,
    `volume: ${byKind('volume').map(measure).join(', ')}`,
    `count: ${byKind('count')
      .map((u) => u.key)
      .join(', ')} (no weight of their own; see unitGrams)`,
  ].join('\n');
}
