'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/UiComponents';
import { Illustration } from '@/components/product/Illustration';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export type ReflectionPhase = 'LOADING' | 'GENERATING' | 'READY' | 'TIMED_OUT';

/**
 * Reflection card (product spec § 11, design-scope screen 3, design.md
 * "Product UI" › note surface): a Sparkles header with the day's paragraph
 * beneath and one action, "Got it", while it is the morning moment. Long
 * paragraphs show their first lines with "Read more" so the score card stays
 * near the fold. Once acknowledged, the header is a title strip with a "Read
 * again" toggle that expands in place. The "based on an earlier log" badge
 * and Update reflection show wherever the card sits, and a calm skeleton
 * while the paragraph is being prepared. Action-free: the island passes
 * callbacks; History passes none and gets the paragraph always expanded.
 */
export function ReflectionCard({
  phase,
  paragraph,
  stale,
  isStatic = false,
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
  /** A fresh-start paragraph written without an AI call (first day, no records, no plan). */
  isStatic?: boolean;
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
  const capped = ready && !acknowledged && onAcknowledge !== undefined;
  const [readMore, setReadMore] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const clamped = capped && !readMore;

  useEffect(() => {
    if (!clamped) return;
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [clamped, paragraph]);

  return (
    <section
      aria-labelledby="reflection-title"
      data-testid="reflection-card"
      data-phase={phase}
      data-acknowledged={acknowledged ? 'true' : 'false'}
      className={cn('space-y-3', className)}
    >
      <SectionHeader
        id="reflection-title"
        icon={Sparkles}
        title={title}
        trailing={
          ready && !acknowledged && onAcknowledge ? (
            <Button
              type="button"
              variant="outline"
              className="px-3"
              onClick={onAcknowledge}
              data-testid="reflection-got-it"
            >
              <Check aria-hidden="true" />
              {t('reflection.gotIt')}
            </Button>
          ) : collapsible ? (
            <button
              type="button"
              onClick={() => onToggleExpanded(!open)}
              aria-expanded={open}
              aria-controls={bodyId}
              className="-me-2 flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-testid="reflection-toggle"
            >
              {open ? t('reflection.collapse') : t('reflection.readAgain')}
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          ) : undefined
        }
      />

      {phase === 'LOADING' || phase === 'GENERATING' ? (
        <Surface variant="note" className="space-y-2" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">{t('reflection.preparing')}</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </Surface>
      ) : null}

      {phase === 'TIMED_OUT' ? (
        <Surface variant="note" className="space-y-3" role="status">
          <p className="text-sm font-medium">{t('reflection.stillPreparing')}</p>
          <p className="text-sm text-muted-foreground">{t('reflection.stillPreparingBody')}</p>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              {t('reflection.retry')}
            </Button>
          ) : null}
        </Surface>
      ) : null}

      {ready ? (
        <Surface variant="note" id={bodyId} className={cn('space-y-3', !open && 'hidden')}>
          {stale ? (
            <Badge variant="secondary" data-testid="reflection-stale">
              {t('reflection.staleBadge')}
            </Badge>
          ) : null}
          {/* Capped to about four lines with a soft fade until "Read more"; the sunrise floats so text flows around it. */}
          <div
            ref={bodyRef}
            className={cn('relative', clamped && 'max-h-[6.25rem] overflow-hidden')}
          >
            {isStatic && !acknowledged ? (
              <Illustration
                name="firstDay"
                size={64}
                className="float-start -my-1 mb-1 me-4 text-muted-foreground"
              />
            ) : null}
            <p
              className="bidi-plaintext max-w-prose text-[15px] leading-relaxed"
              data-testid="reflection-paragraph"
            >
              {paragraph}
            </p>
            {clamped && overflows ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted to-transparent"
                aria-hidden="true"
              />
            ) : null}
          </div>
          {clamped && overflows ? (
            <Button
              type="button"
              variant="ghost"
              className="-ms-4 -my-2 text-muted-foreground"
              onClick={() => setReadMore(true)}
              data-testid="reflection-more"
            >
              {t('reflection.readMore')}
              <ChevronDown aria-hidden="true" />
            </Button>
          ) : null}
          {stale && onUpdate ? (
            <Button
              type="button"
              variant="outline"
              onClick={onUpdate}
              disabled={updating}
              data-testid="reflection-update"
            >
              <RefreshCw className={cn(updating && 'animate-spin')} aria-hidden="true" />
              {updating ? t('reflection.updating') : t('reflection.update')}
            </Button>
          ) : null}
        </Surface>
      ) : null}
    </section>
  );
}
