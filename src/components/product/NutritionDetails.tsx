'use client';

import { Disclosure } from '@/components/product/Disclosure';
import { formatNumber } from '@/lib/format';
import type { RubricTarget, TargetComparison } from '@/lib/rubric/types';
import { t, tp, type MessageKey } from '@/lib/t';
import { MAIN_NUTRIENTS, type NutrientKey } from '@/lib/validations/nutrition';

/**
 * Nutrition details (product spec § 9 "Today's nutrition details"): recorded
 * totals against the plan's targets with their source labelled, the number of
 * recorded meals, log completeness, the estimates note and missing values.
 * Other nutrients sit in a nested disclosure and only when a target exists.
 */
export function NutritionDetails({
  nutrition,
  mealCount,
  logComplete,
  ongoing,
  className,
}: {
  nutrition: TargetComparison[];
  mealCount: number;
  logComplete: boolean;
  ongoing: boolean;
  className?: string;
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
      className={className}
      testId="nutrition-details"
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {tp('nutrition.meals', mealCount)} · {logLabel}
        </p>
        <dl className="divide-y divide-border">
          {main.map((row) => (
            <NutrientRow key={row.nutrient} row={row} />
          ))}
        </dl>
        {others.length > 0 ? (
          <Disclosure label={t('nutrition.more')} triggerClassName="font-normal">
            <dl className="divide-y divide-border">
              {others.map((row) => (
                <NutrientRow key={row.nutrient} row={row} />
              ))}
            </dl>
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

function NutrientRow({ row }: { row: TargetComparison }) {
  const unit = UNITS[row.nutrient];
  const recorded =
    row.subtotal.value === null ? t('nutrition.unknown') : `${round(row.subtotal.value)} ${unit}`;
  const target = row.target ? targetText(row.target, unit) : null;
  const status = statusText(row, unit);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2" data-nutrient={row.nutrient}>
      <dt className="text-sm font-medium">{nutrientName(row.nutrient)}</dt>
      <dd className="text-end text-sm tabular-nums">
        <span className="sr-only">{t('nutrition.recorded')} </span>
        {recorded}
      </dd>
      <dd className="col-span-2 text-xs text-muted-foreground">
        {row.target && target ? (
          <>
            {t('nutrition.target')}: {target} · {sourceLabel(row.target)}
          </>
        ) : (
          t('nutrition.noTarget')
        )}
      </dd>
      {status ? <dd className="col-span-2 text-xs">{status}</dd> : null}
      {row.subtotal.missingItems > 0 ? (
        <dd className="col-span-2 text-xs text-muted-foreground">
          {tp('nutrition.missing', row.subtotal.missingItems)}
        </dd>
      ) : null}
    </div>
  );
}
