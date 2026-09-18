import { cn } from '@/lib/utils';

/**
 * Original + English name label (design-scope "Shared components"): the only
 * place mixed-direction text is composed (tech spec § 9). The original is
 * isolated in <bdi> so punctuation and digits around it never flip; the
 * English label is an LTR run beneath or beside it.
 */
export function NameLabel({
  originalName,
  englishLabel,
  inline = false,
  className,
  size = 'md',
}: {
  originalName: string;
  englishLabel: string;
  /** Beside (inline) instead of beneath. */
  inline?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const original = originalName.trim();
  const english = englishLabel.trim();
  const same =
    !original || original.localeCompare(english, undefined, { sensitivity: 'base' }) === 0;
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];

  if (same) {
    return (
      <span className={cn('font-medium', sizes, className)} dir="ltr">
        {english || original}
      </span>
    );
  }

  // The <bdi> stays inline: as a block (flex item) Chromium sizes an RTL
  // shrink-to-fit box too wide and the word drifts to the right.
  return (
    <span
      className={cn(inline ? 'inline-flex flex-wrap items-baseline gap-x-2' : 'block', className)}
    >
      <bdi className={cn('font-medium', sizes)}>{original}</bdi>
      <span
        className={cn(
          'text-muted-foreground',
          inline ? '' : 'block',
          size === 'lg' ? 'text-sm' : 'text-xs',
        )}
        dir="ltr"
      >
        {english}
      </span>
    </span>
  );
}
