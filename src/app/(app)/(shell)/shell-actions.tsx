'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { LogMealButton } from '@/components/layout/LogMealButton';
import { openComposer } from '@/components/product/composer-bus';
import { showsLogMealButton } from '@/lib/navigation';
import { MealComposerIsland } from './meal-composer';

/**
 * Mounts the persistent Log meal button and the composer island. The button
 * and every other page open the composer through the composer bus; the
 * island also opens on `?compose=1[&slot=<id>&option=<id>&date=YYYY-MM-DD]`.
 * The island stays mounted on every route (Meal details reuses it), only
 * the button hides where it would cover the page.
 */
export function ShellActions({ photoEnabled }: { photoEnabled: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {showsLogMealButton(pathname) ? <LogMealButton onClick={() => openComposer()} /> : null}
      <Suspense fallback={null}>
        <MealComposerIsland photoEnabled={photoEnabled} />
      </Suspense>
    </>
  );
}
