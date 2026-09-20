import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SurfaceVariant = 'hero' | 'list' | 'note';

type SurfaceTag = 'div' | 'section' | 'article' | 'aside' | 'ul' | 'ol';

const VARIANT: Record<SurfaceVariant, string> = {
  // The one elevated surface per screen: tinted emerald, 16 px, level-1 shadow.
  hero: 'rounded-card bg-tint-2 text-foreground shadow-1',
  // Hairline container whose rows are divided by hairlines; rows pad themselves.
  list: 'divide-y divide-border rounded-xl border border-border bg-card text-card-foreground',
  // Borderless: muted fill, or a 3 px emerald start rule with `rule`.
  note: 'rounded-xl bg-muted text-foreground',
};

const RULE = 'rounded-none border-s-[3px] border-primary bg-transparent ps-3';

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
} as const;

const DEFAULT_PADDING: Record<SurfaceVariant, keyof typeof PADDING> = {
  hero: 'md',
  list: 'none',
  note: 'md',
};

/**
 * The three product surfaces (design.md "Product UI" › Surfaces, decision
 * 025): `hero` for the score card, `list` for rows, `note` for the
 * reflection, hints and empty states. There is no other card recipe on
 * product screens; grouping comes from a SectionHeader above, not a border.
 */
export function Surface({
  variant,
  as: Tag = 'div',
  padding,
  rule = false,
  className,
  children,
  ...rest
}: {
  variant: SurfaceVariant;
  as?: SurfaceTag;
  /** `hero` and `note` default to 16 px, `list` to none (rows pad themselves). */
  padding?: keyof typeof PADDING;
  /** `note` only: a 3 px emerald start rule instead of the muted fill. */
  rule?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <Tag
      className={cn(
        'text-start',
        VARIANT[variant],
        PADDING[padding ?? DEFAULT_PADDING[variant]],
        variant === 'note' && rule && RULE,
        className,
      )}
      data-surface={variant}
      {...rest}
    >
      {children}
    </Tag>
  );
}
