'use client';

import { NameLabel } from '@/components/product/NameLabel';
import { Surface } from '@/components/product/Surface';
import { t, tp } from '@/lib/t';
import type { DraftSlot } from '@/lib/validations/plan';
import { ReviewActions } from './SlotReview';
import { weekdayName } from './helpers';

/**
 * Weekday plans (screen 7a): after one day is reviewed in full, the other
 * six days are listed compactly — one list surface per day — and confirmed
 * together, so review never becomes a wall of corrections (product spec § 5).
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
          <Surface key={day.weekday} variant="list" as="li">
            <p className="px-3 py-2 font-display text-sm font-semibold">
              {weekdayName(day.weekday)}
            </p>
            <ul className="divide-y divide-border/60">
              {day.slots.map((slot) => (
                <li
                  key={slot.key}
                  className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <NameLabel
                    originalName={slot.originalName}
                    englishLabel={slot.englishLabel}
                    size="sm"
                  />
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {tp('plan.option.count', slot.options.length)}
                  </span>
                </li>
              ))}
            </ul>
          </Surface>
        ))}
      </ul>
      <p className="font-display text-base font-semibold">{t('plan.review.applySameChecks')}</p>
      <ReviewActions
        primary={t('plan.review.applyAll')}
        saving={saving}
        onPrimary={onApplyAll}
        onBack={onBack}
        secondary={t('plan.review.reviewEachDay')}
        onSecondary={onReviewEach}
      />
    </div>
  );
}
