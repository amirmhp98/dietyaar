'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { cn } from '@/lib/utils';

const MD_QUERY = '(min-width: 768px)';

/** True on md+ viewports; false until mounted (the modal never renders on the server). */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(MD_QUERY);
    const update = () => setWide(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * The composer's container: a bottom sheet on phones (full height, scrolling
 * inside) and a centered dialog on md+ (design-scope screen 4). The header
 * and footer stay fixed; `children` scroll.
 */
export function ComposerModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const wide = useIsWide();
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2" data-testid="composer-body">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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
            <DialogTitle>{title}</DialogTitle>
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
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className={cn(!description && 'sr-only')}>
            {description ?? title}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
