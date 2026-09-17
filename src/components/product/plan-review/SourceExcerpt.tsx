import { t } from '@/lib/t';

/**
 * The excerpt of the source text a review section was extracted from
 * (product spec § 6 "Review your plan"): a quiet quoted block beside the
 * section so the user can compare without leaving the screen.
 */
export function SourceExcerpt({ text, label }: { text: string | null; label?: string }) {
  if (!text || text.trim() === '') return null;
  return (
    <figure className="border-s-2 border-border ps-3">
      <figcaption className="text-xs text-muted-foreground">
        {label ?? t('plan.sourceExcerpt')}
      </figcaption>
      <blockquote className="whitespace-pre-wrap text-sm" dir="auto">
        <bdi>{text}</bdi>
      </blockquote>
    </figure>
  );
}
