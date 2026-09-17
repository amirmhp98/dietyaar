'use client';

import { useState } from 'react';
import { LogMealButton } from '@/components/layout/LogMealButton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/UiComponents';
import { t } from '@/lib/t';

/** Mounts the Log meal button and the composer sheet (filled in phase 6). */
/** STUB composer: the meal agent replaces this with the real MealComposer island. */
export function ShellActions(_props: { timeZone: string; photoEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <LogMealButton onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('meal.compose.title')}</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}
