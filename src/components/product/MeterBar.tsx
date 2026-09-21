import { cn } from '@/lib/utils';

function clamp(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/**
 * A thin neutral bar (design.md "Product UI", decision 025): ink over a faint
 * track, never red, never emerald. `value` is the filled fraction, `band` an
 * optional target range drawn on the track; a null value hatches the track.
 * With a `label` it is a progressbar for assistive tech; without one it is
 * decorative and the text beside it speaks.
 */
export function MeterBar({
  value,
  band,
  label,
  className,
}: {
  /** Filled fraction 0–1; null when it could not be summed, which hatches the track. */
  value: number | null;
  /** Target range as fractions of the scale, drawn as a darker band. */
  band?: { from: number; to: number };
  label?: string;
  className?: string;
}) {
  const unknown = value === null;
  const fill = unknown ? 0 : clamp(value);
  const aria =
    label === undefined
      ? { 'aria-hidden': true as const }
      : {
          role: 'progressbar',
          'aria-label': label,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': Math.round(fill * 100),
        };
  return (
    <div
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10',
        unknown &&
          'text-foreground/25 bg-[repeating-linear-gradient(-45deg,transparent_0_3px,currentColor_3px_4px)]',
        className,
      )}
      data-testid="meter-bar"
      {...aria}
    >
      {band ? (
        <div
          className="absolute inset-y-0 rounded-full bg-foreground/15"
          style={{
            insetInlineStart: `${clamp(band.from) * 100}%`,
            width: `${(clamp(band.to) - clamp(band.from)) * 100}%`,
          }}
        />
      ) : null}
      {/* Width, not translate, so the fill grows from the inline-start edge in both directions. */}
      {!unknown ? (
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-foreground/60 transition-[width] duration-250 ease-out"
          style={{ width: `${fill * 100}%` }}
        />
      ) : null}
    </div>
  );
}
