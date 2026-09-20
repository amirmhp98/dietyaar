'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, FormField, Input } from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { AmountPrefix } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { t } from '@/lib/t';
import type { DraftItem, DraftOption, DraftSlot } from '@/lib/validations/plan';
import { UnitSelect } from './UnitSelect';
import { newKey, numberText, parseNumber, renamed, withQuantity } from './helpers';

/**
 * Inline editor for one slot: name, times, options and their items (name,
 * amount, unit). Used by 7a "Fix" and by the manual wizard. A name typed here
 * is also the English label (the AI's label survives only edits to other
 * fields); changing a quantity or a name clears "Assumed" and flags the item
 * for re-estimation on 7b. A quantity typed without a unit is in grams.
 * Typing a time turns an assumed window into a stated one. With
 * `compactItems`, a named item is one row (amount · name · pencil) until its
 * pencil opens the fields (decision 025); items without a name start open.
 */

export function newItem(position: number): DraftItem {
  return {
    key: newKey(),
    position,
    originalName: '',
    englishLabel: '',
    quantity: null,
    unit: null,
    unitGrams: null,
    quantityAssumed: false,
    assumedDefaultKey: null,
    preparationNote: null,
    alternatives: [],
    category: 'OTHER',
    nutrition: null,
    sourceExcerpt: '',
    needsEstimate: true,
  };
}

export function newOption(position: number, withItem = true): DraftOption {
  return { key: newKey(), position, label: null, items: withItem ? [newItem(0)] : [] };
}

export function newSlot(weekday: number, position: number): DraftSlot {
  return {
    key: newKey(),
    weekday,
    position,
    originalName: '',
    englishLabel: '',
    timeStart: null,
    timeEnd: null,
    timeAssumed: false,
    sourceExcerpt: '',
    // Items come on the next wizard screen; an empty option is valid until then.
    options: [newOption(0, false)],
    reviewed: false,
  };
}

export function SlotEditor({
  slot,
  onChange,
  showNames = true,
  showTimes = false,
  compactItems = false,
}: {
  slot: DraftSlot;
  onChange: (slot: DraftSlot) => void;
  showNames?: boolean;
  showTimes?: boolean;
  compactItems?: boolean;
}) {
  function setOption(index: number, option: DraftOption) {
    const options = slot.options.map((o, i) => (i === index ? option : o));
    onChange({ ...slot, options });
  }
  function removeOption(index: number) {
    if (slot.options.length <= 1) return;
    onChange({
      ...slot,
      options: slot.options.filter((_, i) => i !== index).map((o, i) => ({ ...o, position: i })),
    });
  }
  function addOption() {
    onChange({ ...slot, options: [...slot.options, newOption(slot.options.length)] });
  }

  return (
    <div className="space-y-5">
      {showNames ? (
        <FormField label={t('plan.review.slotName')} required>
          <Input
            dir="auto"
            className="h-11"
            value={slot.originalName}
            maxLength={200}
            onChange={(e) => onChange(renamed(slot, e.target.value))}
          />
        </FormField>
      ) : null}
      {showTimes ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('plan.review.timeStart')}>
              <Input
                inputMode="numeric"
                dir="auto"
                className="h-11"
                placeholder="08:00"
                value={slot.timeStart ?? ''}
                onChange={(e) =>
                  onChange({ ...slot, timeStart: e.target.value || null, timeAssumed: false })
                }
              />
            </FormField>
            <FormField label={t('plan.review.timeEnd')}>
              <Input
                inputMode="numeric"
                dir="auto"
                className="h-11"
                placeholder="09:00"
                value={slot.timeEnd ?? ''}
                onChange={(e) =>
                  onChange({ ...slot, timeEnd: e.target.value || null, timeAssumed: false })
                }
              />
            </FormField>
          </div>
          {slot.timeAssumed ? (
            <p className="text-xs text-muted-foreground">{t('plan.time.assumedHint')}</p>
          ) : null}
        </div>
      ) : null}
      {slot.options.map((option, index) => (
        <OptionEditor
          key={option.key}
          option={option}
          index={index}
          showHeader={slot.options.length > 1}
          compactItems={compactItems}
          onChange={(next) => setOption(index, next)}
          onRemove={slot.options.length > 1 ? () => removeOption(index) : undefined}
        />
      ))}
      <Button type="button" variant="outline" className="w-full" onClick={addOption}>
        <Plus aria-hidden="true" />
        {t('plan.review.addOption')}
      </Button>
    </div>
  );
}

function OptionEditor({
  option,
  index,
  showHeader,
  compactItems,
  onChange,
  onRemove,
}: {
  option: DraftOption;
  index: number;
  showHeader: boolean;
  compactItems: boolean;
  onChange: (option: DraftOption) => void;
  onRemove?: () => void;
}) {
  function setItem(i: number, item: DraftItem) {
    onChange({ ...option, items: option.items.map((it, j) => (j === i ? item : it)) });
  }
  function removeItem(i: number) {
    onChange({
      ...option,
      items: option.items.filter((_, j) => j !== i).map((it, j) => ({ ...it, position: j })),
    });
  }
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-card p-3">
      {showHeader ? (
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">{t('plan.option.n', { n: index + 1 })}</legend>
          {onRemove ? (
            <IconAction label={t('plan.review.removeOption')} icon={Trash2} onClick={onRemove} />
          ) : null}
        </div>
      ) : null}
      {option.items.map((item, i) => (
        <ItemEditor
          key={item.key}
          item={item}
          compact={compactItems}
          onChange={(next) => setItem(i, next)}
          onRemove={option.items.length > 1 ? () => removeItem(i) : undefined}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() =>
          onChange({ ...option, items: [...option.items, newItem(option.items.length)] })
        }
      >
        <Plus aria-hidden="true" />
        {t('plan.review.addItem')}
      </Button>
    </fieldset>
  );
}

function ItemEditor({
  item,
  compact,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  /** Start as one row with a pencil; an item without a name always starts open. */
  compact: boolean;
  onChange: (item: DraftItem) => void;
  onRemove?: () => void;
}) {
  const [quantityInvalid, setQuantityInvalid] = useState(false);
  const [open, setOpen] = useState(!compact || item.originalName.trim() === '');
  if (!open) {
    return (
      <div className="flex min-h-11 items-center gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm">
          <AmountPrefix quantity={item.quantity} unit={item.unit} className="text-sm" />
          <NameLabel originalName={item.originalName} englishLabel={item.englishLabel} size="sm" />
        </div>
        <IconAction
          label={t('plan.review.editItem', { name: item.originalName })}
          icon={Pencil}
          onClick={() => setOpen(true)}
          data-testid="edit-item"
        />
      </div>
    );
  }
  return (
    <div className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-end gap-2">
        <FormField className="min-w-0 flex-1" label={t('plan.review.itemName')} required>
          <Input
            dir="auto"
            className="h-11"
            value={item.originalName}
            maxLength={200}
            onChange={(e) => onChange({ ...renamed(item, e.target.value), needsEstimate: true })}
          />
        </FormField>
        {onRemove ? (
          <IconAction
            label={t('plan.review.removeItem')}
            icon={Trash2}
            className="shrink-0"
            onClick={onRemove}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <FormField
          label={t('plan.review.quantity')}
          error={quantityInvalid ? t('plan.manual.numberInvalid') : undefined}
        >
          <QuantityInput
            value={item.quantity}
            onInvalid={setQuantityInvalid}
            onChange={(quantity) => onChange(withQuantity(item, quantity))}
          />
        </FormField>
        <FormField label={t('plan.review.unit')}>
          <UnitSelect
            ariaLabel={t('plan.review.unit')}
            value={item.unit}
            unitGrams={item.unitGrams}
            onChange={(unit) =>
              onChange({
                ...item,
                unit,
                unitGrams: null,
                quantityAssumed: false,
                needsEstimate: true,
              })
            }
            onUnitGramsChange={(unitGrams) => onChange({ ...item, unitGrams, needsEstimate: true })}
          />
        </FormField>
      </div>
    </div>
  );
}

/** Keeps the raw text while typing so "1." or Persian digits do not snap back. */
export function QuantityInput({
  value,
  onChange,
  onInvalid,
  id,
  ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  onInvalid?: (invalid: boolean) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const [raw, setRaw] = useState(numberText(value));
  return (
    <Input
      id={id}
      inputMode="decimal"
      dir="auto"
      className="h-11"
      aria-label={ariaLabel}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const parsed = parseNumber(e.target.value);
        const invalid = parsed !== null && Number.isNaN(parsed);
        onInvalid?.(invalid);
        if (!invalid) onChange(parsed);
      }}
    />
  );
}
