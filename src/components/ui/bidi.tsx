import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Inline LTR isolate for codes, phone numbers, emails, URLs, and IBANs inside
 * RTL text, so they never reorder or split the surrounding sentence.
 */
export function Ltr({ className, ...props }: React.ComponentProps<'bdi'>) {
  return <bdi dir="ltr" className={cn('font-[inherit]', className)} {...props} />;
}
