import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

/**
 * The excerpt of the source text a review section was extracted from
 * (product spec § 6 "Review your plan"): a note surface with the emerald
 * start rule beside the section, so the user can compare without leaving
 * the screen.
 */
export function SourceExcerpt({ text }: { text: string | null }) {
  if (!text || text.trim() === '') return null;
  return (
    <Surface variant="note" rule as="section" padding="none" className="py-1">
      <p className="text-xs text-muted-foreground">{t('plan.sourceExcerpt')}</p>
      <blockquote className="mt-0.5 whitespace-pre-wrap text-sm" dir="auto">
        <bdi>{text}</bdi>
      </blockquote>
    </Surface>
  );
}
