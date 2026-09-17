'use client';

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export type ImportBannerState = 'PENDING' | 'READY' | 'FAILED';

/**
 * Import status banner (product spec § 9): one line above the plan block
 * while an import is running, ready to review, or failed.
 */
export function ImportStatusBanner({
  state,
  onReview,
  onRetry,
  onManual,
  className,
}: {
  state: ImportBannerState;
  onReview?: () => void;
  onRetry?: () => void;
  onManual?: () => void;
  className?: string;
}) {
  const Icon = state === 'PENDING' ? Loader2 : state === 'READY' ? CheckCircle2 : AlertTriangle;
  const text =
    state === 'PENDING'
      ? t('import.pending')
      : state === 'READY'
        ? t('import.ready')
        : t('import.failed');
  return (
    <div
      role="status"
      data-testid="import-banner"
      data-state={state}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground',
            state === 'PENDING' && 'animate-spin',
          )}
          aria-hidden="true"
        />
        <p>{text}</p>
      </div>
      {state === 'READY' && onReview ? (
        <Button type="button" className="h-11" onClick={onReview}>
          {t('import.reviewNow')}
        </Button>
      ) : null}
      {state === 'FAILED' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-11" onClick={onRetry}>
            {t('import.tryAgain')}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={onManual}>
            {t('import.setUpManually')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
