'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/UiComponents';
import { useIsWide } from '@/components/product/meal/use-media-query';
import { cn } from '@/lib/utils';

/**
 * The composer's container: a bottom sheet on phones (full height, scrolling
 * inside) and a centered dialog on md+ (design-scope screen 4). The header
 * and footer stay fixed; `children` scroll. `leading` sits before the title
 * (the review's back arrow), `actions` after it (Start over).
 */
export function ComposerModal({
  open,
  onOpenChange,
  title,
  description,
  leading,
  actions,
  footer,
  children,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const wide = useIsWide();
  const heading = (node: ReactNode) => (
    <div className="flex min-h-9 items-center gap-2 pe-8">
      {leading}
      <div className="min-w-0 flex-1">{node}</div>
      {actions}
    </div>
  );
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2" data-testid="composer-body">
        {children}
      </div>
      {footer ? (
        <div
          className="max-h-[70dvh] shrink-0 overflow-y-auto border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          data-testid="composer-footer"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
          data-testid={testId}
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 text-start">
            {heading(<DialogTitle className="font-display">{title}</DialogTitle>)}
            <DialogDescription className={cn(!description && 'sr-only')}>
              {description ?? title}
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-t-none p-0"
        data-testid={testId}
      >
        <SheetHeader className="shrink-0 px-4 pb-2 pt-5 text-start">
          {heading(<SheetTitle className="font-display">{title}</SheetTitle>)}
          <SheetDescription className={cn(!description && 'sr-only')}>
            {description ?? title}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
