'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

/** "Start over": icon + one word, the same control in the review header and the resumed banner. */
export function StartOverButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 shrink-0 text-muted-foreground"
      onClick={onClick}
      disabled={disabled}
      data-testid="start-over"
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      {t('meal.compose.startOver')}
    </Button>
  );
}

/** One muted line when the sheet opens on a draft from before, with Start over beside it (B8). */
export function ResumedBanner({
  onStartOver,
  disabled,
}: {
  onStartOver: () => void;
  disabled?: boolean;
}) {
  return (
    <Surface
      variant="note"
      padding="none"
      className="flex items-center justify-between gap-2 ps-3 pe-1 py-1 text-sm text-muted-foreground"
      role="status"
      data-testid="resumed-banner"
    >
      <span>{t('meal.compose.resumed')}</span>
      <StartOverButton onClick={onStartOver} disabled={disabled} />
    </Surface>
  );
}
