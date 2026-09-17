import { normalizeInput } from '@/lib/text/normalize';
import type { FoodName, RubricAlternative } from '@/lib/rubric/types';

/**
 * The one food-name comparison (product spec § 8: spelling and synonyms may be
 * normalised, a related food is never an equivalent). Two foods are the same
 * when their normalised English labels or original names are equal, or a
 * synonym / in-item alternative is.
 */
export function foodKey(text: string): string {
  return normalizeInput(text)
    .toLowerCase()
    .replace(/[‌‌]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keysOf(
  food: FoodName & { alternatives?: RubricAlternative[]; synonyms?: string[] },
): Set<string> {
  const keys = new Set<string>();
  const add = (v: string | undefined | null) => {
    if (!v) return;
    const k = foodKey(v);
    if (k) keys.add(k);
  };
  add(food.originalName);
  add(food.englishLabel);
  for (const alt of food.alternatives ?? []) {
    add(alt.originalName);
    add(alt.englishLabel);
  }
  for (const s of food.synonyms ?? []) add(s);
  return keys;
}

export function sameFood(
  a: FoodName & { alternatives?: RubricAlternative[]; synonyms?: string[] },
  b: FoodName & { alternatives?: RubricAlternative[]; synonyms?: string[] },
): boolean {
  const ka = keysOf(a);
  for (const k of keysOf(b)) if (ka.has(k)) return true;
  return false;
}
