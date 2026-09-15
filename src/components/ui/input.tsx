import * as React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  state?: 'error' | 'success';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            state === 'error' && 'border-error focus-visible:ring-error',
            state === 'success' && 'border-success focus-visible:ring-success',
            state && 'pe-10',
            className,
          )}
          ref={ref}
          {...props}
        />
        {state === 'error' && (
          <AlertCircle className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-error pointer-events-none" />
        )}
        {state === 'success' && (
          <CheckCircle className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-success pointer-events-none" />
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
