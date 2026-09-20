'use client';

import { CircleAlert, CircleCheck, Loader } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export type ImportBannerState = 'PENDING' | 'READY' | 'FAILED';

/**
 * Import status banner (product spec § 9, design.md "Product UI" › note): one
 * line with a state icon above the plan block while an import is running,
 * ready to review, or failed. Its actions are outline: the floating Log meal
 * button stays the one filled emerald on the screen.
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
  const Icon = state === 'PENDING' ? Loader : state === 'READY' ? CircleCheck : CircleAlert;
  const text =
    state === 'PENDING'
      ? t('import.pending')
      : state === 'READY'
        ? t('import.ready')
        : t('import.failed');
  return (
    <Surface
      variant="note"
      rule
      role="status"
      data-testid="import-banner"
      data-state={state}
      className={cn('space-y-3 text-sm', className)}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            'mt-0.5 size-5 shrink-0 text-muted-foreground',
            state === 'PENDING' && 'animate-spin motion-reduce:animate-none',
          )}
          aria-hidden="true"
        />
        <p className="pt-0.5">{text}</p>
      </div>
      {state === 'READY' && onReview ? (
        <Button type="button" variant="outline" className="w-full" onClick={onReview}>
          {t('import.reviewNow')}
        </Button>
      ) : null}
      {state === 'FAILED' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            {t('import.tryAgain')}
          </Button>
          <Button type="button" variant="ghost" onClick={onManual}>
            {t('import.setUpManually')}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
