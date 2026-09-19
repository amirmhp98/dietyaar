'use client';

import { Disclosure } from '@/components/product/Disclosure';
import { InlineName } from '@/components/product/InlineName';
import { formatNumber } from '@/lib/format';
import { WEIGHT_FOOD, WEIGHT_PORTION, WEIGHT_TIMING } from '@/lib/rubric/constants';
import type { DayView } from '@/lib/rubric/types';
import { t } from '@/lib/t';

/**
 * "Why this score" (product spec § 8 display): each scored slot's components
 * and what was excluded, the nutrition component, and the rubric version.
 * Renders nothing until a prescribed meal has been scored: there is no score
 * to explain yet, and the card's hint already says what unlocks it.
 */
export function WhyThisScore({ view, className }: { view: DayView; className?: string }) {
  const scored = view.slots.filter((s) => s.score && s.score.score !== null);
  if (scored.length === 0) return null;
  const nutrition =
    view.score.nutritionComponent === null
      ? t('day.why.nutritionLeftOut')
      : view.score.nutritionComponent >= 1
        ? t('day.why.nutritionFull')
        : view.score.nutritionComponent > 0
          ? t('day.why.nutritionHalf')
          : t('day.why.nutritionNone');

  return (
    <Disclosure label={t('day.why.title')} className={className} testId="why-this-score">
      <div className="space-y-3 text-sm">
        {!view.logComplete ? (
          <p className="text-muted-foreground">{t('day.why.basedOnRecorded')}</p>
        ) : null}
        <ul className="divide-y divide-border">
          {scored.map((s) => {
            const score = s.score!;
            const components = [
              score.food !== null
                ? t('day.why.component', {
                    name: t('day.why.food'),
                    value: formatNumber(Math.round(score.food * WEIGHT_FOOD)),
                    weight: WEIGHT_FOOD,
                  })
                : null,
              score.portion !== null
                ? t('day.why.component', {
                    name: t('day.why.portion'),
                    value: formatNumber(Math.round(score.portion * WEIGHT_PORTION)),
                    weight: WEIGHT_PORTION,
                  })
                : null,
              score.timing !== null
                ? t('day.why.component', {
                    name: t('day.why.timing'),
                    value: formatNumber(Math.round(score.timing * WEIGHT_TIMING)),
                    weight: WEIGHT_TIMING,
                  })
                : null,
            ].filter((c): c is string => c !== null);
            const excluded = score.excluded.map((e) =>
              e === 'FOOD'
                ? t('day.why.food')
                : e === 'PORTION'
                  ? t('day.why.portion')
                  : t('day.why.timing'),
            );
            return (
              <li key={s.slot.id} className="space-y-0.5 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    <InlineName name={s.slot} />
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t('day.why.slotScore', { score: Math.round(score.score ?? 0) })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{components.join(' · ')}</p>
                {excluded.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('day.why.leftOut', { components: excluded.join(', ').toLowerCase() })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{nutrition}</p>
        <p className="text-xs text-muted-foreground">
          {t('day.why.rubric', { version: view.rubricVersion })}
        </p>
      </div>
    </Disclosure>
  );
}
