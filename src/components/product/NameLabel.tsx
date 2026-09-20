import { cn } from '@/lib/utils';

/**
 * A food or slot name as the user wrote it (design-scope "Shared components",
 * decision 10): the only block form of mixed-direction text (tech spec § 9).
 * The name is isolated in <bdi> so punctuation and digits around it never
 * flip. The English label the AI produced stays in the data for matching and
 * prompts; it is never shown and only stands in when the original is blank.
 */
export function NameLabel({
  originalName,
  englishLabel = '',
  className,
  size = 'md',
}: {
  originalName: string;
  /** Fallback only: rendered when `originalName` is blank. */
  englishLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];
  // The <bdi> stays inline: as a block (flex item) Chromium sizes an RTL
  // shrink-to-fit box too wide and the word drifts to the right.
  return (
    <span className={cn('block', className)}>
      <bdi className={cn('font-medium', sizes)}>{originalName.trim() || englishLabel.trim()}</bdi>
    </span>
  );
}
