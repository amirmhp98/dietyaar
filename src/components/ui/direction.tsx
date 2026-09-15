'use client';

import * as React from 'react';
import {
  DirectionProvider as RadixDirectionProvider,
  useDirection,
} from '@radix-ui/react-direction';
import { locale, type Direction } from '@/lib/locale';

export type LogicalSide = 'top' | 'bottom' | 'start' | 'end';
export type PhysicalSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Root direction context. Radix primitives (Select, DropdownMenu, Tabs,
 * Slider, …) read it for keyboard navigation and placement, so no component
 * needs its own `dir` prop.
 */
export function DirectionProvider({
  dir = locale.dir,
  children,
}: {
  dir?: Direction;
  children: React.ReactNode;
}) {
  return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}

/** Current direction from the nearest DirectionProvider. */
export function useDir(): Direction {
  return useDirection();
}

/** Map a logical side (`start`/`end`) to the physical side Radix expects. */
export function resolveSide(
  side: LogicalSide | PhysicalSide | undefined,
  dir: Direction,
): PhysicalSide | undefined {
  if (side === 'start') return dir === 'rtl' ? 'right' : 'left';
  if (side === 'end') return dir === 'rtl' ? 'left' : 'right';
  return side;
}
