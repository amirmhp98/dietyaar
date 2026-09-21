'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Badge, Label } from '@/components/UiComponents';
import { InlineNames, nameText } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';
import { StatusGlyph } from '@/components/product/StatusGlyph';
import { Surface } from '@/components/product/Surface';
import { OTHER_SLOT } from '@/components/product/meal/composition';
import { formatNumber } from '@/lib/format';
import { sortedOptions } from '@/lib/rubric/options';
import type { RubricOption, RubricSlot } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';
import { cn } from '@/lib/utils';

export { OTHER_SLOT };

/** The option's energy when every item states one; otherwise nothing is claimed. */
function optionKcal(option: RubricOption): number | null {
  let sum = 0;
  for (const item of option.items) {
    const kcal = item.nutrition?.values.ENERGY_KCAL;
    if (kcal === null || kcal === undefined) return null;
    sum += kcal;
  }
  return option.items.length > 0 ? Math.round(sum) : null;
}

/**
 * The options of a slot as a list surface (D2a): one 44 px row per option —
 * "Option n" in the display face, its items as the plan names them, the
 * energy when known, "Last time" on the last pick. Radio semantics; nothing
 * is preselected (product spec § 7).
 */
export function OptionList({
  slot,
  selectedOptionId,
  lastUsedOptionId,
  onPick,
  testId,
}: {
  slot: RubricSlot;
  selectedOptionId: string | null;
  lastUsedOptionId: string | null;
  onPick: (optionId: string) => void;
  testId?: string;
}) {
  return (
    <Surface
      variant="list"
      role="radiogroup"
      aria-label={t('meal.compose.chooseOption')}
      data-testid={testId}
    >
      {sortedOptions(slot).map((option, index) => {
        const selected = option.id === selectedOptionId;
        const kcal = optionKcal(option);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`option-${slot.id}-${index + 1}`}
            onClick={() => onPick(option.id)}
            className={cn(
              'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start transition-colors first:rounded-t-xl last:rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected ? 'bg-tint-2' : 'hover:bg-tint-1 active:bg-tint-3',
            )}
          >
            <span
              className={cn(
                'grid size-5 shrink-0 place-content-center rounded-full border',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
              aria-hidden="true"
            >
              {selected ? <Check className="size-3.5" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-semibold">
                  {t('plan.option.n', { n: index + 1 })}
                </span>
                {option.id === lastUsedOptionId ? (
                  <Badge variant="secondary">{t('meal.compose.lastTime')}</Badge>
                ) : null}
              </span>
              <span className="block text-xs text-muted-foreground">
                <InlineNames names={option.items} />
              </span>
            </span>
            {kcal !== null ? (
              <span
                className="shrink-0 font-display text-sm tabular-nums text-muted-foreground"
                dir="ltr"
              >
                {formatNumber(kcal)} {t('meal.nutrient.unit.kcal')}
              </span>
            ) : null}
          </button>
        );
      })}
    </Surface>
  );
}

/**
 * "Today's planned meals" (compose step, text-first layout): one pill per
 * slot in plan order with its status glyph — recorded slots carry the check
 * (O D14) and stay selectable. A single-option slot logs on tap; a
 * multi-option slot expands its options beneath the row, the last-used one
 * marked "Last time".
 */
export function PlannedSlotsRow({
  slots,
  lastUsed,
  recordedSlotIds = [],
  onExpand,
  onPick,
}: {
  slots: RubricSlot[];
  lastUsed: Record<string, string | null>;
  recordedSlotIds?: readonly string[];
  onExpand: (slotId: string) => void;
  onPick: (slotId: string, optionId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const open = slots.find((s) => s.id === expanded) ?? null;
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {slots.map((slot) => {
          const options = sortedOptions(slot);
          const multi = options.length > 1;
          const isOpen = expanded === slot.id;
          const recorded = recordedSlotIds.includes(slot.id);
          return (
            <button
              key={slot.id}
              type="button"
              data-testid={`slot-chip-${slot.id}`}
              aria-expanded={multi ? isOpen : undefined}
              onClick={() => {
                if (!multi) {
                  if (options[0]) onPick(slot.id, options[0].id);
                  return;
                }
                const next = isOpen ? null : slot.id;
                setExpanded(next);
                if (next) onExpand(slot.id);
              }}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border ps-3 pe-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isOpen ? 'border-primary bg-tint-2' : 'border-border bg-card hover:bg-tint-1',
              )}
            >
              <span data-testid={recorded ? 'slot-recorded' : undefined} className="flex">
                <StatusGlyph status={recorded ? 'RECORDED' : 'NOT_RECORDED'} size="sm" />
              </span>
              <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
              {multi ? (
                <span className="text-xs text-muted-foreground">
                  {tp('meal.compose.optionCount', options.length)}
                </span>
              ) : null}
              {multi ? (
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {open ? (
        <OptionList
          slot={open}
          selectedOptionId={null}
          lastUsedOptionId={lastUsed[open.id] ?? null}
          onPick={(optionId) => onPick(open.id, optionId)}
          testId="slot-options"
        />
      ) : null}
    </div>
  );
}

/**
 * Slot picker for "More details" and the review's "Change": the day's plan
 * slots plus "Extra · in addition to your plan"; a multi-option slot then
 * lists its options.
 */
export function SlotSelect({
  slots,
  slotId,
  optionId,
  lastUsed,
  onChange,
  idPrefix,
  trailing,
}: {
  slots: RubricSlot[];
  /** null = not chosen yet, OTHER_SLOT = explicitly "Other". */
  slotId: string | null;
  optionId: string | null;
  lastUsed: Record<string, string | null>;
  onChange: (slotId: string | null, optionId: string | null) => void;
  idPrefix: string;
  /** One control beside the label (the review's Change action). */
  trailing?: ReactNode;
}) {
  const selected = slots.find((s) => s.id === slotId) ?? null;
  const showOptions = selected !== null && selected.options.length > 1;
  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label htmlFor={`${idPrefix}-slot`}>{t('meal.compose.slot')}</Label>
        {trailing}
      </div>
      <div className="relative">
        <select
          id={`${idPrefix}-slot`}
          data-testid="slot-select"
          className="h-11 w-full appearance-none rounded-md border border-input bg-transparent px-3 pe-9 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
          value={slotId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value === '') {
              onChange(null, null);
              return;
            }
            const slot = slots.find((s) => s.id === value);
            const only = slot && slot.options.length === 1 ? slot.options[0].id : null;
            onChange(value, only);
          }}
        >
          <option value="">{t('meal.compose.slotNone')}</option>
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {nameText(slot)}
            </option>
          ))}
          <option value={OTHER_SLOT}>{t('meal.compose.slotOther')}</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {showOptions ? (
        <OptionList
          slot={selected}
          selectedOptionId={optionId}
          lastUsedOptionId={lastUsed[selected.id] ?? null}
          onPick={(id) => onChange(selected.id, id)}
        />
      ) : null}
    </div>
  );
}
