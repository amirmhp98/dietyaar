import { NameLabel } from '@/components/product/NameLabel';
import { t } from '@/lib/t';
import type { Nutrition } from '@/lib/validations/nutrition';

/** Where each item's values came from, one line per item: "Food database · 12345", "Label values you entered", or "No values". */
export function SourcesList({
  items,
}: {
  items: Array<{ originalName: string; nutrition: Nutrition | null }>;
}) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={index} className="flex flex-wrap items-baseline gap-x-2">
          <NameLabel
            originalName={item.originalName.trim() || t('meal.review.newItem')}
            size="sm"
          />
          <span className="text-muted-foreground">
            {item.nutrition
              ? `${t(`meal.review.source.${item.nutrition.source}`)}${item.nutrition.sourceRef ? ` · ${item.nutrition.sourceRef}` : ''}`
              : t('meal.review.sourceNone')}
          </span>
        </li>
      ))}
    </ul>
  );
}
