import { sameFood } from '@/lib/rubric/names';
import type { FoodName, RubricFoodItem, RubricRule, RuleObservation } from '@/lib/rubric/types';

/**
 * Explicit plan rules (product spec § 8 "Variety"): progress within the
 * period, a final status only when the period ended with complete data. They
 * never enter the score. Definition shapes are validated in
 * lib/validations/plan.ts; unknown shapes yield a NOTE observation.
 */
export interface RuleDay {
  localDate: string;
  items: RubricFoodItem[];
  /** Items grouped by meal so a serving counts once per meal. */
  mealItems: RubricFoodItem[][];
  logComplete: boolean;
  /** Every prescribed slot recorded or skipped and at least one meal. */
  complete: boolean;
  weekday: number;
}

interface FoodDef extends FoodName {
  synonyms?: string[];
}

function foodMatches(item: RubricFoodItem, food: FoodDef): boolean {
  return sameFood(item, food);
}

function readFood(v: unknown): FoodDef | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.originalName !== 'string' || typeof o.englishLabel !== 'string') return null;
  return {
    originalName: o.originalName,
    englishLabel: o.englishLabel,
    synonyms: Array.isArray(o.synonyms)
      ? o.synonyms.filter((s): s is string => typeof s === 'string')
      : [],
  };
}

export function ruleObservation(
  rule: RubricRule,
  days: RuleDay[],
  periodEnded: boolean,
): RuleObservation {
  const base = { ruleId: rule.id, kind: rule.kind, periodEnded };
  const def = (rule.definition ?? {}) as Record<string, unknown>;
  const dataComplete = days.every((d) => d.complete);

  switch (rule.kind) {
    case 'SERVING_COUNT': {
      const food = readFood(def.food);
      const required = typeof def.count === 'number' ? def.count : null;
      const comparator = (def.comparator as string) ?? 'AT_LEAST';
      if (!food || required === null)
        return { ...base, status: 'NOTE', count: null, required: null, hits: [] };
      const hits: FoodName[] = [];
      let count = 0;
      for (const day of days) {
        for (const meal of day.mealItems) {
          const hit = meal.find((i) => foodMatches(i, food));
          if (hit) {
            count += 1;
            hits.push({ originalName: hit.originalName, englishLabel: hit.englishLabel });
          }
        }
      }
      let status: RuleObservation['status'] = 'PROGRESS';
      if (periodEnded) {
        if (!dataComplete) status = 'INCOMPLETE';
        else if (comparator === 'AT_MOST') status = count <= required ? 'MET' : 'NOT_MET';
        else if (comparator === 'EXACT') status = count === required ? 'MET' : 'NOT_MET';
        else status = count >= required ? 'MET' : 'NOT_MET';
      } else if (comparator === 'AT_MOST' && count > required) status = 'NOT_MET';
      return { ...base, status, count, required, hits };
    }
    case 'DISTINCT_GROUPS': {
      const groups = Array.isArray(def.groups) ? (def.groups as string[]) : [];
      const minimum = typeof def.minimum === 'number' ? def.minimum : null;
      if (minimum === null)
        return { ...base, status: 'NOTE', count: null, required: null, hits: [] };
      const seen = new Set<string>();
      const hits: FoodName[] = [];
      for (const day of days) {
        for (const item of day.items) {
          const memberships = new Set<string>([...item.ruleGroups, item.category]);
          for (const g of groups) {
            if (memberships.has(g) && !seen.has(g)) {
              seen.add(g);
              hits.push({ originalName: item.originalName, englishLabel: item.englishLabel });
            }
          }
        }
      }
      let status: RuleObservation['status'] = 'PROGRESS';
      if (periodEnded)
        status = !dataComplete ? 'INCOMPLETE' : seen.size >= minimum ? 'MET' : 'NOT_MET';
      return { ...base, status, count: seen.size, required: minimum, hits };
    }
    case 'NAMED_WEEKDAY_FOOD': {
      // Observation only: the food component already scores that day's slot.
      const food = readFood(def.food);
      const weekday = typeof def.weekday === 'number' ? def.weekday : null;
      if (!food || weekday === null)
        return { ...base, status: 'NOTE', count: null, required: null, hits: [] };
      const day = days.find((d) => d.weekday === weekday);
      const hit = day?.items.find((i) => foodMatches(i, food));
      const hits = hit ? [{ originalName: hit.originalName, englishLabel: hit.englishLabel }] : [];
      let status: RuleObservation['status'] = 'PROGRESS';
      if (day && (day.complete || periodEnded))
        status = hit ? 'MET' : day.complete ? 'NOT_MET' : 'INCOMPLETE';
      return { ...base, status, count: hits.length, required: 1, hits };
    }
    case 'EXCLUSION': {
      const foods = Array.isArray(def.foods)
        ? (def.foods as unknown[]).map(readFood).filter((f): f is FoodDef => !!f)
        : [];
      const hits: FoodName[] = [];
      for (const day of days) {
        for (const item of day.items) {
          if (foods.some((f) => foodMatches(item, f)))
            hits.push({ originalName: item.originalName, englishLabel: item.englishLabel });
        }
      }
      const status: RuleObservation['status'] =
        hits.length > 0
          ? 'FLAGGED'
          : periodEnded
            ? dataComplete
              ? 'MET'
              : 'INCOMPLETE'
            : 'PROGRESS';
      return { ...base, status, count: hits.length, required: 0, hits };
    }
    case 'TIMING_WINDOW':
    case 'INSTRUCTION':
    default:
      return { ...base, status: 'NOTE', count: null, required: null, hits: [] };
  }
}
