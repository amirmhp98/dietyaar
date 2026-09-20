import { Clock, Flame } from 'lucide-react';
import { Badge } from '@/components/UiComponents';
import { Disclosure } from '@/components/product/Disclosure';
import { AmountPrefix, GramsEach } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { SlotWindowText } from '@/components/product/SlotWindow';
import { Surface } from '@/components/product/Surface';
import { formatNumber } from '@/lib/format';
import { sortedOptions } from '@/lib/rubric/options';
import type { RubricOption, RubricPlanItem, RubricSlot, RubricTarget } from '@/lib/rubric/types';
import { windowOf } from '@/lib/rubric/windows';
import { t, tp } from '@/lib/t';

/**
 * Read-only slot card for My plan (design-scope screen 6, decision 025): a
 * list surface whose header row carries the name, the window with a clock
 * ("≈" when assumed from the name) and the energy range with a flame; one
 * option lists its items directly, several fold behind "Option n · k items"
 * pills. The Today page has its own interactive row; this one never logs.
 */
export function PlanSlotSummary({ slot, range }: { slot: RubricSlot; range: RubricTarget | null }) {
  const window = windowOf(slot);
  const options = sortedOptions(slot);
  return (
    <Surface variant="list" as="li" data-testid="plan-slot-card">
      <div className="space-y-1 px-3 py-3">
        <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
        {window || range ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {window ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                <SlotWindowText window={window} />
              </span>
            ) : null}
            {range ? (
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5 shrink-0" aria-hidden="true" />
                <span dir="ltr">
                  {t('plan.target.rangeValue', {
                    low: formatNumber(range.low, { maximumFractionDigits: 0 }),
                    high: formatNumber(range.high, { maximumFractionDigits: 0 }),
                    unit: t('plan.unit.kcal'),
                  })}
                </span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {options.length === 1 ? (
        <ItemList items={options[0].items} />
      ) : (
        <ol className="space-y-1 p-2" aria-label={tp('plan.option.count', options.length)}>
          {options.map((option, index) => (
            <OptionPill key={option.id} option={option} index={index} />
          ))}
        </ol>
      )}
    </Surface>
  );
}

/** "Option n · k items" as a pill inside a 44 px disclosure row; its items open beneath. */
function OptionPill({ option, index }: { option: RubricOption; index: number }) {
  return (
    <li>
      <Disclosure
        testId={`plan-option-${index + 1}`}
        triggerClassName="w-fit gap-1.5 rounded-full px-1 pe-2 text-xs font-normal"
        label={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-medium">
            {t('plan.option.n', { n: index + 1 })}
            <span className="text-muted-foreground">
              · {tp('plan.option.items', option.items.length)}
            </span>
          </span>
        }
      >
        <ItemList items={option.items} inset />
      </Disclosure>
    </li>
  );
}

function ItemList({ items, inset = false }: { items: RubricPlanItem[]; inset?: boolean }) {
  return (
    <ul className={inset ? 'space-y-2 ps-2 pt-1' : 'divide-y divide-border'}>
      {items.map((item) => (
        <ItemLine key={item.id} item={item} inset={inset} />
      ))}
    </ul>
  );
}

/** One prescribed item: the amount before the name ("2 × سیب", "150 g · مرغ"), grams each for counts. */
function ItemLine({ item, inset }: { item: RubricPlanItem; inset: boolean }) {
  return (
    <li className={inset ? 'text-sm' : 'px-3 py-2 text-sm'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <AmountPrefix quantity={item.quantity} unit={item.unit} className="text-sm" />
            <NameLabel
              originalName={item.originalName}
              englishLabel={item.englishLabel}
              size="sm"
            />
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
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {item.quantity === null ? <span>{t('plan.item.noQuantity')}</span> : null}
          {item.quantityAssumed ? <Badge variant="outline">{t('plan.assumed')}</Badge> : null}
        </div>
      </div>
    </li>
  );
}
