'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export type ReflectionPhase = 'LOADING' | 'GENERATING' | 'READY' | 'TIMED_OUT';

/**
 * Reflection card (product spec § 11, design-scope screen 3): the day's
 * paragraph, a collapse toggle remembered per date, the "based on an earlier
 * log" badge with Update reflection when stale, and a calm skeleton while the
 * paragraph is being prepared. Action-free: the island passes callbacks.
 */
export function ReflectionCard({
  phase,
  paragraph,
  stale,
  collapsed,
  title = t('reflection.title'),
  onToggleCollapsed,
  onUpdate,
  onRetry,
  updating = false,
  className,
}: {
  phase: ReflectionPhase;
  paragraph: string | null;
  stale: boolean;
  collapsed: boolean;
  title?: string;
  onToggleCollapsed?: (collapsed: boolean) => void;
  onUpdate?: () => void;
  onRetry?: () => void;
  updating?: boolean;
  className?: string;
}) {
  const bodyId = 'reflection-paragraph';
  return (
    <section
      aria-labelledby="reflection-title"
      data-testid="reflection-card"
      data-phase={phase}
      className={cn('rounded-xl border border-border bg-card p-4', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="reflection-title" className="text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        {phase === 'READY' && onToggleCollapsed ? (
          <button
            type="button"
            onClick={() => onToggleCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="-me-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="reflection-collapse"
          >
            {collapsed ? t('reflection.expand') : t('reflection.collapse')}
            <ChevronDown
              className={cn('size-4 transition-transform duration-200', !collapsed && 'rotate-180')}
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

      {phase === 'READY' ? (
        <div id={bodyId} className={cn('mt-3 space-y-3', collapsed && 'hidden')}>
          {stale ? (
            <Badge variant="secondary" data-testid="reflection-stale">
              {t('reflection.staleBadge')}
            </Badge>
          ) : null}
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
