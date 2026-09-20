import { Badge } from '@/components/UiComponents';
import { AmountPrefix, GramsEach } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { SlotWindowText } from '@/components/product/SlotWindow';
import { formatNumber } from '@/lib/format';
import { sortedOptions } from '@/lib/rubric/options';
import type { RubricPlanItem, RubricSlot, RubricTarget } from '@/lib/rubric/types';
import { windowOf } from '@/lib/rubric/windows';
import { t, tp } from '@/lib/t';

/**
 * Read-only slot card for My plan (design-scope screen 6): name, window
 * ("≈" when assumed from the name), the per-meal energy range, and the
 * options with their items. The Today page has its own interactive row; this
 * one never links or logs.
 */
export function PlanSlotSummary({ slot, range }: { slot: RubricSlot; range: RubricTarget | null }) {
  const window = windowOf(slot);
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
          {window ? (
            <p className="text-xs text-muted-foreground">
              <SlotWindowText window={window} />
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          {range ? (
            <span dir="ltr">
              {t('plan.target.rangeValue', {
                low: formatNumber(range.low, { maximumFractionDigits: 0 }),
                high: formatNumber(range.high, { maximumFractionDigits: 0 }),
                unit: t('plan.unit.kcal'),
              })}
            </span>
          ) : null}
          {slot.options.length > 1 ? (
            <span>{tp('plan.option.count', slot.options.length)}</span>
          ) : null}
        </div>
      </div>
      <ol className="space-y-2">
        {sortedOptions(slot).map((option, index) => (
          <li
            key={option.id}
            className={slot.options.length > 1 ? 'border-t border-border pt-2' : ''}
          >
            {slot.options.length > 1 ? (
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t('plan.option.n', { n: index + 1 })}
              </p>
            ) : null}
            <ul className="space-y-1">
              {option.items.map((item) => (
                <ItemLine key={item.id} item={item} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </li>
  );
}

/** One prescribed item: the amount before the name ("2 × سیب", "150 g · مرغ"), grams each for counts. */
function ItemLine({ item }: { item: RubricPlanItem }) {
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <AmountPrefix quantity={item.quantity} unit={item.unit} className="text-sm" />
          <NameLabel originalName={item.originalName} englishLabel={item.englishLabel} size="sm" />
        </div>
        <GramsEach unit={item.unit} unitGrams={item.unitGrams} className="block" />
        {item.alternatives.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('plan.item.alternatives', {
              names: item.alternatives.map((a) => a.originalName).join(' / '),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
        {item.quantity === null ? <span>{t('plan.item.noQuantity')}</span> : null}
        {item.quantityAssumed ? <Badge variant="outline">{t('plan.assumed')}</Badge> : null}
      </div>
    </li>
  );
}
