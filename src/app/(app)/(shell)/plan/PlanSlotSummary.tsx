import { Badge } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { formatNumber } from '@/lib/format';
import { unitLabel } from '@/components/product/plan-review/helpers';
import type { RubricPlanItem, RubricSlot, RubricTarget } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';

/**
 * Read-only slot card for My plan (design-scope screen 6): name, time, the
 * per-meal energy range, and the options with their items. The Today page
 * has its own interactive row; this one never links or logs.
 */
export function PlanSlotSummary({ slot, range }: { slot: RubricSlot; range: RubricTarget | null }) {
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
          {slot.timeStart ? (
            <p className="text-xs text-muted-foreground" dir="ltr">
              {slot.timeEnd
                ? t('plan.time.range', { start: slot.timeStart, end: slot.timeEnd })
                : slot.timeStart}
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
        {slot.options.map((option, index) => (
          <li
            key={option.id}
            className={slot.options.length > 1 ? 'border-t border-border pt-2' : ''}
          >
            {slot.options.length > 1 ? (
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {option.label ? (
                  <bdi>{option.label}</bdi>
                ) : (
                  t('plan.option.label', { n: index + 1 })
                )}
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

function ItemLine({ item }: { item: RubricPlanItem }) {
  const amount =
    item.quantity === null
      ? t('plan.item.noQuantity')
      : t('plan.item.quantityUnit', {
          quantity: formatNumber(item.quantity, { maximumFractionDigits: 2 }),
          unit: unitLabel(item.unit),
        }).trim();
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <NameLabel originalName={item.originalName} englishLabel={item.englishLabel} size="sm" />
        {item.alternatives.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('plan.item.alternatives', {
              names: item.alternatives.map((a) => a.originalName).join(' / '),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <span dir="ltr">{amount}</span>
        {item.quantityAssumed ? <Badge variant="outline">{t('plan.assumed')}</Badge> : null}
      </div>
    </li>
  );
}
