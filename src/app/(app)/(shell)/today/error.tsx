'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

/** Focused retry for a day that failed to load (product spec § 9 "Error"). */
export default function TodayError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Surface variant="note" rule className="space-y-3" role="alert">
      <h1 className="font-display text-base font-semibold">{t('error.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('today.error.description')}</p>
      <Button type="button" variant="outline" onClick={reset}>
        <RotateCcw aria-hidden="true" />
        {t('today.error.retry')}
      </Button>
    </Surface>
  );
}
