import { ArrowDown, ArrowUp, Clock, Plus, Shuffle, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DifferenceKind =
  | 'PORTION_MORE'
  | 'PORTION_LESS'
  | 'ORDER'
  | 'TIME'
  | 'DIFFERENT_FOOD'
  | 'CROSS_SLOT'
  | 'ADDED'
  | 'MISSING'
  | 'MIXED';

const ICONS: Record<DifferenceKind, typeof ArrowUp> = {
  PORTION_MORE: ArrowUp,
  PORTION_LESS: ArrowDown,
  ORDER: Shuffle,
  TIME: Clock,
  DIFFERENT_FOOD: Utensils,
  CROSS_SLOT: Shuffle,
  ADDED: Plus,
  MISSING: Utensils,
  MIXED: Shuffle,
};

/**
 * Difference chip: one neutral, descriptive observation as a pill (design.md
 * "Product UI" › Shape). Never colour-only; the icon and text carry the
 * meaning (product spec § 8, § 12).
 */
export function DifferenceChip({
  kind,
  children,
  className,
}: {
  kind: DifferenceKind;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}
