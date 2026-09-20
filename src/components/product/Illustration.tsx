import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type IllustrationName = 'noPlan' | 'noMeals' | 'firstDay' | 'ready';

const EMERALD = 'hsl(var(--primary))';

// Ink is `currentColor` (inherits the text colour); emerald is the one accent.
const ART: Record<IllustrationName, ReactNode> = {
  noPlan: (
    <>
      <rect x="30" y="24" width="60" height="78" rx="10" />
      <rect x="46" y="16" width="28" height="14" rx="5" fill={EMERALD} />
      <path d="M44 50h32" />
      <path d="M44 64h32" />
      <path d="M44 78h18" strokeDasharray="3 5" opacity="0.6" />
      <circle cx="88" cy="94" r="14" fill={EMERALD} />
      <path d="M88 87v14M81 94h14" />
    </>
  ),
  noMeals: (
    <>
      <ellipse cx="60" cy="64" rx="34" ry="24" />
      <ellipse cx="60" cy="64" rx="21" ry="14" />
      <path d="M15 34v10M20 34v10M25 34v10" />
      <path d="M15 44a5 5 0 0 0 10 0" />
      <path d="M20 49v40" />
      <path d="M101 34v55" />
      <path d="M101 34c-7 5-8 17-2 25" />
      <path d="M60 66c-2-10 4-16 12-16-1 9-5 14-12 16Z" fill={EMERALD} />
      <path d="M60 66l6-8" />
    </>
  ),
  firstDay: (
    <>
      <path d="M12 84h96" />
      <path d="M36 84a24 24 0 0 1 48 0Z" fill={EMERALD} />
      <path d="M60 54V44" />
      <path d="M39 63l-7-7M81 63l7-7" />
      <path d="M32 74l-10-4M88 74l10-4" />
      <path d="M30 98h60" opacity="0.5" />
    </>
  ),
  ready: (
    <>
      <circle cx="60" cy="62" r="30" />
      <path d="M46 63l9 9 20-21" stroke={EMERALD} strokeWidth="4" />
      <path d="M22 22v8M18 26h8" />
      <path d="M98 30v8M94 34h8" />
      <path d="M18 92v6M15 95h6" />
      <circle cx="34" cy="14" r="2.5" fill={EMERALD} stroke="none" />
      <circle cx="88" cy="16" r="2.5" fill={EMERALD} stroke="none" />
      <circle cx="100" cy="90" r="3" fill={EMERALD} stroke="none" />
    </>
  ),
};

/**
 * Two-tone line illustrations for empty states and the onboarding Ready
 * screen (design.md "Product UI" › Illustrations, decision 025): ink from
 * `currentColor`, emerald from the primary token, 96–120 px. Decorative —
 * the empty-state copy beside it carries the meaning.
 */
export function Illustration({
  name,
  size = 112,
  className,
}: {
  name: IllustrationName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 text-foreground', className)}
      data-testid={`illustration-${name}`}
    >
      {ART[name]}
    </svg>
  );
}
