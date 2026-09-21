'use client';

import { Disclosure } from '@/components/product/Disclosure';
import { MeterBar } from '@/components/product/MeterBar';
import { formatNumber } from '@/lib/format';
import type { RubricTarget, TargetComparison } from '@/lib/rubric/types';
import { t, tp, type MessageKey } from '@/lib/t';
import { MAIN_NUTRIENTS, type NutrientKey } from '@/lib/validations/nutrition';

/**
 * Nutrition details (product spec § 9 "Today's nutrition details", design.md
 * "Product UI"): energy first, then one value / target row per nutrient with
 * a thin neutral bar (recorded against the range; hatched when unknown), the
 * source and status behind a per-row disclosure; the number of recorded
 * meals, log completeness and the estimates note around them. Other
 * nutrients sit in a nested disclosure and only when a target exists.
 */
export function NutritionDetails({
  nutrition,
  mealCount,
  logComplete,
  ongoing,
}: {
  nutrition: TargetComparison[];
  mealCount: number;
  logComplete: boolean;
  ongoing: boolean;
}) {
  const main = MAIN_NUTRIENTS.map((key) => nutrition.find((n) => n.nutrient === key)).filter(
    (n): n is TargetComparison => n !== undefined,
  );
  const others = nutrition.filter(
    (n) => !(MAIN_NUTRIENTS as readonly string[]).includes(n.nutrient) && n.target !== null,
  );
  const logLabel = ongoing
    ? t('nutrition.log.inProgress')
    : logComplete
      ? t('nutrition.log.complete')
      : t('nutrition.log.incomplete');

  return (
    <Disclosure
      label={ongoing ? t('nutrition.title') : t('nutrition.titlePast')}
      testId="nutrition-details"
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {tp('nutrition.meals', mealCount)} · {logLabel}
        </p>
        <ul className="divide-y divide-border">
          {main.map((row) => (
            <NutrientRow key={row.nutrient} row={row} />
          ))}
        </ul>
        {others.length > 0 ? (
          <Disclosure label={t('nutrition.more')} triggerClassName="font-normal">
            <ul className="divide-y divide-border">
              {others.map((row) => (
                <NutrientRow key={row.nutrient} row={row} />
              ))}
            </ul>
          </Disclosure>
        ) : null}
        <p className="text-xs text-muted-foreground">{t('nutrition.estimates')}</p>
      </div>
    </Disclosure>
  );
}

const UNITS: Record<NutrientKey, string> = {
  ENERGY_KCAL: 'kcal',
  PROTEIN_G: 'g',
  CARB_G: 'g',
  FAT_G: 'g',
  FIBER_G: 'g',
  SODIUM_MG: 'mg',
};

function nutrientName(key: NutrientKey): string {
  return t(`nutrition.nutrient.${key}` as MessageKey & `nutrition.nutrient.${NutrientKey}`);
}

function round(value: number): string {
  return formatNumber(Math.round(value));
}

function targetText(target: RubricTarget, unit: string): string | null {
  const { type, low, high } = target;
  if (type === 'RANGE' && low !== null && high !== null)
    return t('nutrition.target.range', { low: round(low), high: round(high), unit });
  if (type === 'MINIMUM' && low !== null)
    return t('nutrition.target.min', { value: round(low), unit });
  if (type === 'MAXIMUM') {
    const limit = high ?? low;
    return limit === null ? null : t('nutrition.target.max', { value: round(limit), unit });
  }
  return low === null ? null : t('nutrition.target.about', { value: round(low), unit });
}

function sourceLabel(target: RubricTarget): string {
  return target.source === 'EXPLICIT'
    ? t('nutrition.source.explicit')
    : target.source === 'ESTIMATED'
      ? t('nutrition.source.estimated')
      : t('nutrition.source.sumOfMeals');
}

function statusText(row: TargetComparison, unit: string): string | null {
  const diff = row.difference === null ? null : round(Math.abs(row.difference));
  switch (row.status) {
    case 'BELOW_RANGE':
      return t('nutrition.status.belowRange', { value: diff ?? '', unit });
    case 'WITHIN_RANGE':
      return t('nutrition.status.withinRange');
    case 'ABOVE_RANGE':
      return t('nutrition.status.aboveRange', { value: diff ?? '', unit });
    case 'BELOW_TARGET':
      return t('nutrition.status.belowTarget', { value: diff ?? '', unit });
    case 'TARGET_MET':
      return t('nutrition.status.targetMet');
    case 'WITHIN_LIMIT':
      return t('nutrition.status.withinLimit');
    case 'ABOVE_LIMIT':
      return t('nutrition.status.aboveLimit', { value: diff ?? '', unit });
    case 'SIGNED_DIFFERENCE':
      return (row.difference ?? 0) >= 0
        ? t('nutrition.status.above', { value: diff ?? '', unit })
        : t('nutrition.status.below', { value: diff ?? '', unit });
    case 'PROGRESS':
      return t('nutrition.status.progress');
    case 'INCOMPLETE':
      return t('nutrition.status.incomplete');
    case 'NO_TARGET':
      return null;
  }
}

/**
 * The bar's scale and the target band on it; no bar without a target. The
 * scale runs to a quarter past the target's upper bound (or the recorded
 * value, whichever is larger) so a value beyond the range still shows how
 * far; a minimum runs its band to the end, a maximum from the start, a single
 * figure is a narrow band around it.
 */
function nutrientBar(
  row: TargetComparison,
): { value: number | null; band: { from: number; to: number } } | null {
  const recorded = row.subtotal.value;
  const target = row.target;
  if (!target) return null;
  const { type, low, high } = target;
  const reference = high ?? low;
  if (reference === null || reference <= 0) return null;
  const scale = Math.max(reference * 1.25, recorded ?? 0);
  const band =
    type === 'RANGE' && low !== null && high !== null
      ? { from: low / scale, to: high / scale }
      : type === 'MINIMUM'
        ? { from: reference / scale, to: 1 }
        : type === 'MAXIMUM'
          ? { from: 0, to: reference / scale }
          : { from: (reference * 0.97) / scale, to: (reference * 1.03) / scale };
  return { value: recorded === null ? null : recorded / scale, band };
}

function NutrientRow({ row }: { row: TargetComparison }) {
  const unit = UNITS[row.nutrient];
  const unknown = row.subtotal.value === null;
  const recorded = unknown ? t('nutrition.unknown') : `${round(row.subtotal.value!)} ${unit}`;
  const target = row.target ? targetText(row.target, unit) : null;
  const status = statusText(row, unit);
  const bar = nutrientBar(row);
  return (
    <li data-nutrient={row.nutrient}>
      <Disclosure
        triggerClassName="px-1 py-2 font-normal"
        contentClassName="pb-3 pt-0"
        label={
          <span className="block space-y-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{nutrientName(row.nutrient)}</span>
              <span className="shrink-0 text-end text-sm tabular-nums">
                <span className="sr-only">{t('nutrition.recorded')} </span>
                {recorded}
                {target ? (
                  <span className="text-muted-foreground">
                    <span className="sr-only"> {t('nutrition.target')}</span> / {target}
                  </span>
                ) : null}
              </span>
            </span>
            {bar ? <MeterBar value={bar.value} band={bar.band} /> : null}
          </span>
        }
      >
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            {row.target && target ? (
              <>
                {t('nutrition.target')}: {target} · {sourceLabel(row.target)}
              </>
            ) : (
              t('nutrition.noTarget')
            )}
          </p>
          {status ? <p className="text-foreground">{status}</p> : null}
          {row.subtotal.missingItems > 0 ? (
            <p>{tp('nutrition.missing', row.subtotal.missingItems)}</p>
          ) : null}
        </div>
      </Disclosure>
    </li>
  );
}
