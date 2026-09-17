'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { t } from '@/lib/t';

/** Focused retry for a day that failed to load (product spec § 9 "Error"). */
export default function HistoryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4" role="alert">
      <h1 className="text-base font-semibold">{t('error.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('today.error.description')}</p>
      <Button type="button" variant="outline" className="h-11" onClick={reset}>
        <RotateCcw className="size-4" aria-hidden="true" />
        {t('today.error.retry')}
      </Button>
    </div>
  );
}
