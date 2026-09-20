'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, FormField, Input } from '@/components/UiComponents';
import { t } from '@/lib/t';
import type { DraftItem, DraftOption, DraftSlot } from '@/lib/validations/plan';
import { UnitSelect } from './UnitSelect';
import { newKey, numberText, parseNumber } from './helpers';

/**
 * Inline editor for one slot: names, options and their items (name, amount,
 * unit). Used by 8a "Fix" and by the manual wizard. Changing a quantity or a
 * name clears "Assumed" and flags the item for re-estimation on 8b.
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
}: {
  slot: DraftSlot;
  onChange: (slot: DraftSlot) => void;
  showNames?: boolean;
  showTimes?: boolean;
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
        <div className="grid gap-3">
          <FormField label={t('plan.review.slotName')} required>
            <Input
              dir="auto"
              className="h-11"
              value={slot.originalName}
              maxLength={200}
              onChange={(e) => onChange({ ...slot, originalName: e.target.value })}
            />
          </FormField>
          <FormField label={t('plan.review.slotEnglish')}>
            <Input
              dir="auto"
              className="h-11"
              value={slot.englishLabel}
              maxLength={200}
              onChange={(e) => onChange({ ...slot, englishLabel: e.target.value })}
            />
          </FormField>
        </div>
      ) : null}
      {showTimes ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('plan.review.timeStart')}>
            <Input
              inputMode="numeric"
              dir="auto"
              className="h-11"
              placeholder="08:00"
              value={slot.timeStart ?? ''}
              onChange={(e) => onChange({ ...slot, timeStart: e.target.value || null })}
            />
          </FormField>
          <FormField label={t('plan.review.timeEnd')}>
            <Input
              inputMode="numeric"
              dir="auto"
              className="h-11"
              placeholder="09:00"
              value={slot.timeEnd ?? ''}
              onChange={(e) => onChange({ ...slot, timeEnd: e.target.value || null })}
            />
          </FormField>
        </div>
      ) : null}
      {slot.options.map((option, index) => (
        <OptionEditor
          key={option.key}
          option={option}
          index={index}
          showHeader={slot.options.length > 1}
          onChange={(next) => setOption(index, next)}
          onRemove={slot.options.length > 1 ? () => removeOption(index) : undefined}
        />
      ))}
      <Button type="button" variant="outline" className="h-11 w-full" onClick={addOption}>
        <Plus className="size-4" aria-hidden="true" />
        {t('plan.review.addOption')}
      </Button>
    </div>
  );
}

function OptionEditor({
  option,
  index,
  showHeader,
  onChange,
  onRemove,
}: {
  option: DraftOption;
  index: number;
  showHeader: boolean;
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
    <fieldset className="space-y-4 rounded-xl border border-border bg-card p-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">
            {option.label ? <bdi>{option.label}</bdi> : t('plan.option.label', { n: index + 1 })}
          </legend>
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={t('plan.review.removeOption')}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
      {option.items.map((item, i) => (
        <ItemEditor
          key={item.key}
          item={item}
          onChange={(next) => setItem(i, next)}
          onRemove={option.items.length > 1 ? () => removeItem(i) : undefined}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full"
        onClick={() =>
          onChange({ ...option, items: [...option.items, newItem(option.items.length)] })
        }
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('plan.review.addItem')}
      </Button>
    </fieldset>
  );
}

function ItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  onChange: (item: DraftItem) => void;
  onRemove?: () => void;
}) {
  const [quantityInvalid, setQuantityInvalid] = useState(false);
  return (
    <div className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-3">
          <FormField label={t('plan.review.itemName')} required>
            <Input
              dir="auto"
              className="h-11"
              value={item.originalName}
              maxLength={200}
              onChange={(e) =>
                onChange({ ...item, originalName: e.target.value, needsEstimate: true })
              }
            />
          </FormField>
          <FormField label={t('plan.review.itemEnglish')}>
            <Input
              dir="auto"
              className="h-11"
              value={item.englishLabel}
              maxLength={200}
              onChange={(e) =>
                onChange({ ...item, englishLabel: e.target.value, needsEstimate: true })
              }
            />
          </FormField>
        </div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-6 h-11 w-11 shrink-0"
            aria-label={t('plan.review.removeItem')}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
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
            onChange={(quantity) =>
              onChange({ ...item, quantity, quantityAssumed: false, needsEstimate: true })
            }
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
