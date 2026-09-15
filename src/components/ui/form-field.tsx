'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, required, error, helperText, children, className, id }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const messageId = `${fieldId}-message`;

    return (
      <div ref={ref} className={cn('space-y-1.5', className)}>
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-error ms-0.5">*</span>}
        </label>

        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
              id: fieldId,
              'aria-describedby': error || helperText ? messageId : undefined,
              'aria-invalid': error ? true : undefined,
            })
          : children}

        {error && (
          <p id={messageId} className="text-sm text-error" aria-live="polite">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={messageId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';

export { FormField };
