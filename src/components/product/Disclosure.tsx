'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/UiComponents';
import { cn } from '@/lib/utils';

/**
 * The one expand/collapse pattern (product spec § 9 acceptance): a 44 px
 * trigger row with a chevron, content beneath. Controlled or uncontrolled.
 */
export function Disclosure({
  label,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  className,
  triggerClassName,
  testId,
}: {
  label: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
  testId?: string;
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        data-testid={testId}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-1 text-start text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          triggerClassName,
        )}
      >
        <span className="min-w-0">{label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <div className="px-1 pb-2 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
