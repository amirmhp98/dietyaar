import { foodKey } from '@/lib/rubric/names';
import type { FoodName } from '@/lib/rubric/types';

export interface RestrictionHit {
  itemId: string;
  item: FoodName;
  /** The restriction as the user wrote it. */
  restriction: string;
}

/**
 * Neutral reminder input (product spec § 7): a recorded item whose normalised
 * name contains a normalised restriction token. Never blocks anything.
 */
export function restrictionHits(
  items: Array<FoodName & { id: string; alternatives?: FoodName[] }>,
  restrictions: Array<{ original: string; normalized: string }>,
): RestrictionHit[] {
  const hits: RestrictionHit[] = [];
  for (const item of items) {
    const haystack = [
      item.originalName,
      item.englishLabel,
      ...(item.alternatives ?? []).flatMap((a) => [a.originalName, a.englishLabel]),
    ]
      .map(foodKey)
      .join(' | ');
    for (const r of restrictions) {
      const needle = singular(foodKey(r.normalized || r.original));
      if (!needle) continue;
      // A short token must match a whole word; a longer one may be a word prefix ("walnut" in "walnuts", "گردو" in "گردویی").
      const pattern =
        needle.length >= 4
          ? new RegExp(`(^|[^\\p{L}\\p{N}])${escape(needle)}`, 'u')
          : new RegExp(`(^|[^\\p{L}\\p{N}])${escape(needle)}(?=$|[^\\p{L}\\p{N}])`, 'u');
      if (pattern.test(haystack)) {
        hits.push({
          itemId: item.id,
          item: { originalName: item.originalName, englishLabel: item.englishLabel },
          restriction: r.original,
        });
        break;
      }
    }
  }
  return hits;
}

/** English plural → singular for the reminder only. */
function singular(word: string): string {
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
