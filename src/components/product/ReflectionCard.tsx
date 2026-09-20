'use client';

import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export type ReflectionPhase = 'LOADING' | 'GENERATING' | 'READY' | 'TIMED_OUT';

/**
 * Reflection card (product spec § 11, design-scope screen 3): the day's
 * paragraph with one action, "Got it", while it is the morning moment; once
 * acknowledged, a title strip with a "Read again" toggle that expands in
 * place. The "based on an earlier log" badge and Update reflection show
 * wherever the card sits, and a calm skeleton while the paragraph is being
 * prepared. Action-free: the island passes callbacks; History passes none
 * and gets the paragraph always expanded.
 */
export function ReflectionCard({
  phase,
  paragraph,
  stale,
  title = t('reflection.title'),
  acknowledged = false,
  expanded = true,
  onToggleExpanded,
  onAcknowledge,
  onUpdate,
  onRetry,
  updating = false,
  className,
}: {
  phase: ReflectionPhase;
  paragraph: string | null;
  stale: boolean;
  title?: string;
  /** "Got it" was tapped for this date: the card collapses to its title with a Read again toggle. */
  acknowledged?: boolean;
  /** Only read while acknowledged: whether the paragraph is shown. */
  expanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
  onAcknowledge?: () => void;
  onUpdate?: () => void;
  onRetry?: () => void;
  updating?: boolean;
  className?: string;
}) {
  const bodyId = 'reflection-paragraph';
  const ready = phase === 'READY';
  const collapsible = ready && acknowledged && onToggleExpanded !== undefined;
  const open = !collapsible || expanded;
  return (
    <section
      aria-labelledby="reflection-title"
      data-testid="reflection-card"
      data-phase={phase}
      data-acknowledged={acknowledged ? 'true' : 'false'}
      className={cn('rounded-xl border border-border bg-card p-4', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="reflection-title" className="text-sm font-medium text-muted-foreground">
            {title}
          </h2>
          {ready && stale ? (
            <Badge variant="secondary" data-testid="reflection-stale">
              {t('reflection.staleBadge')}
            </Badge>
          ) : null}
        </div>
        {ready && !acknowledged && onAcknowledge ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 shrink-0 px-3"
            onClick={onAcknowledge}
            data-testid="reflection-got-it"
          >
            <Check aria-hidden="true" />
            {t('reflection.gotIt')}
          </Button>
        ) : null}
        {collapsible ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(!open)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="-me-2 flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="reflection-toggle"
          >
            {open ? t('reflection.collapse') : t('reflection.readAgain')}
            <ChevronDown
              className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {phase === 'LOADING' || phase === 'GENERATING' ? (
        <div className="mt-3 space-y-2" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">{t('reflection.preparing')}</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : null}

      {phase === 'TIMED_OUT' ? (
        <div className="mt-3 space-y-3" role="status">
          <p className="text-sm font-medium">{t('reflection.stillPreparing')}</p>
          <p className="text-sm text-muted-foreground">{t('reflection.stillPreparingBody')}</p>
          {onRetry ? (
            <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
              {t('reflection.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {ready ? (
        <div id={bodyId} className={cn('mt-3 space-y-3', !open && 'hidden')}>
          <p
            className="bidi-plaintext text-base leading-relaxed"
            data-testid="reflection-paragraph"
          >
            {paragraph}
          </p>
          {stale && onUpdate ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={onUpdate}
              disabled={updating}
              data-testid="reflection-update"
            >
              <RefreshCw className={cn('size-4', updating && 'animate-spin')} aria-hidden="true" />
              {updating ? t('reflection.updating') : t('reflection.update')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
