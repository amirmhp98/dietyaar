import { APP_NAME } from '@/lib/app-config';
import { cn } from '@/lib/utils';

type LogoProps = {
  /** Icon only (collapsed sidebar). */
  compact?: boolean;
  className?: string;
};

/**
 * Placeholder brand mark. Swap the <svg> for your real logo; the wordmark
 * reads APP_NAME, so the name lives in one place.
 * Server-safe: no hooks, no client state.
 */
export function Logo({ compact = false, className }: LogoProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-foreground', className)}
      aria-label={APP_NAME}
    >
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" className="fill-primary/15" />
        <rect x="10" y="10" width="12" height="12" rx="3" className="fill-primary" />
      </svg>
      {!compact && <span className="text-base font-bold tracking-tight">{APP_NAME}</span>}
    </span>
  );
}
