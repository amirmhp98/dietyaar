import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        brand: 'border-transparent bg-brand-400/15 text-brand-400',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/15 text-warning',
        error: 'border-transparent bg-error/15 text-error',
        info: 'border-transparent bg-info/15 text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const dotColorMap: Record<string, string> = {
  default: 'bg-primary-foreground',
  secondary: 'bg-secondary-foreground',
  destructive: 'bg-destructive-foreground',
  outline: 'bg-foreground',
  brand: 'bg-brand-400',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => {
    const variantKey = variant ?? 'default';
    return (
      <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
        {dot && (
          <span
            className={cn('me-1.5 size-1.5 shrink-0 rounded-full', dotColorMap[variantKey])}
            aria-hidden="true"
          />
        )}
        {children}
      </div>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
