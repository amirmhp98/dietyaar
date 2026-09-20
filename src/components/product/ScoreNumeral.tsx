'use client';

import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Count-up length: the one motion longer than the 150–250 ms transitions. */
export const COUNT_UP_MS = 600;

/** Ease-out cubic: the integer shown at `progress` (0–1) of a count from `from` to `to`. */
export function countUpValue(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * (1 - (1 - p) ** 3));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The 40 px score numeral (design.md "Product UI" › Typography and Motion,
 * decision 025): display face, weight 700, tabular. It renders the final
 * value on the server and on first paint; when the value changes it counts
 * up (or down) once from the number on screen, and jumps straight to the new
 * value under `prefers-reduced-motion`.
 */
export function ScoreNumeral({
  value,
  className,
  ...rest
}: { value: number; className?: string } & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const [shown, setShown] = useState(value);
  // The number on screen, so a change mid-count continues from where it is.
  const onScreen = useRef(value);

  useEffect(() => {
    const from = onScreen.current;
    if (from === value) return;
    if (prefersReducedMotion()) {
      onScreen.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = (now - start) / COUNT_UP_MS;
      const next = countUpValue(from, value, progress);
      onScreen.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={cn('font-display text-numeral font-bold tabular-nums', className)} {...rest}>
      {formatNumber(shown)}
    </span>
  );
}
