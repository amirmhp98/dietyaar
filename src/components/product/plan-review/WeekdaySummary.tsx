'use client';

import { Button } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { t, tp } from '@/lib/t';
import type { DraftSlot } from '@/lib/validations/plan';
import { weekdayName } from './helpers';

/**
 * Weekday plans (screen 8a): after one day is reviewed in full, the other
 * six days are listed compactly and confirmed together, so review never
 * becomes a wall of corrections (product spec § 5).
 */
export function WeekdaySummary({
  reviewedWeekday,
  days,
  saving,
  onApplyAll,
  onReviewEach,
  onBack,
}: {
  reviewedWeekday: number;
  days: Array<{ weekday: number; slots: DraftSlot[] }>;
  saving: boolean;
  onApplyAll: () => void;
  onReviewEach: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t('plan.review.weekdaySummaryBody', { day: weekdayName(reviewedWeekday) })}
      </p>
      <ul className="space-y-3">
        {days.map((day) => (
          <li key={day.weekday} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium">{weekdayName(day.weekday)}</p>
            <ul className="space-y-1.5">
              {day.slots.map((slot) => (
                <li key={slot.key} className="flex items-center justify-between gap-3 text-sm">
                  <NameLabel
                    originalName={slot.originalName}
                    englishLabel={slot.englishLabel}
                    size="sm"
                    inline
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tp('plan.option.count', slot.options.length)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-base font-medium">{t('plan.review.applySameChecks')}</p>
      <div className="grid gap-3">
        <Button type="button" className="h-11 w-full" loading={saving} onClick={onApplyAll}>
          {t('plan.review.applyAll')}
        </Button>
        <div className={onBack ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={saving}
              onClick={onBack}
            >
              {t('plan.review.back')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={saving}
            onClick={onReviewEach}
          >
            {t('plan.review.reviewEachDay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
