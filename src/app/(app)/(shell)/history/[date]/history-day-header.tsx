'use client';

import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import { IconAction } from '@/components/product/IconAction';
import { useComposerOpener } from '@/components/product/composer-bus';
import { t } from '@/lib/t';
import { fullDate } from '@/app/(app)/(shell)/today/day-header';

/**
 * Header of one past day (design-scope screen 7 "Day"): the way back, the
 * date in the display face, and an outline "+" that logs a meal for this
 * date (the blocks beneath keep their own "Log meal for this date"), so the
 * floating Log meal button stays the one filled emerald.
 */
export function HistoryDayHeader({ localDate, zone }: { localDate: string; zone: string }) {
  const openComposer = useComposerOpener();
  return (
    <header className="space-y-2">
      <Link
        href="/history"
        className="-ms-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('history.day.backToHistory')}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h2
          className="min-w-0 font-display text-2xl font-semibold leading-tight"
          data-testid="day-date"
        >
          {fullDate(localDate, zone)}
        </h2>
        <IconAction
          label={t('history.day.logMeal')}
          icon={Plus}
          variant="outline"
          onClick={() => openComposer({ localDate })}
          data-testid="log-for-date-header"
        />
      </div>
    </header>
  );
}
