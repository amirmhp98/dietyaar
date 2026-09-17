'use client';

import { Suspense } from 'react';
import { LogMealButton } from '@/components/layout/LogMealButton';
import { openComposer } from '@/components/product/composer-bus';
import { MealComposerIsland } from './meal-composer';

/**
 * Mounts the persistent Log meal button and the composer island. The button
 * and every other page open the composer through the composer bus; the
 * island also opens on `?compose=1[&slot=<id>&option=<id>&date=YYYY-MM-DD]`.
 */
export function ShellActions({
  timeZone,
  photoEnabled,
}: {
  timeZone: string;
  photoEnabled: boolean;
}) {
  return (
    <>
      <LogMealButton onClick={() => openComposer()} />
      <Suspense fallback={null}>
        <MealComposerIsland timeZone={timeZone} photoEnabled={photoEnabled} />
      </Suspense>
    </>
  );
}
