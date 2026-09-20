'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Badge, Label } from '@/components/UiComponents';
import { InlineNames, nameText } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';
import { OTHER_SLOT } from '@/components/product/meal/composition';
import { sortedOptions } from '@/lib/rubric/options';
import type { RubricOption, RubricSlot } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';
import { cn } from '@/lib/utils';

export { OTHER_SLOT };

/** An option's items as the user's plan names them, comma-separated. */
function OptionItems({ option }: { option: RubricOption }) {
  return (
    <span className="block text-xs text-muted-foreground">
      <InlineNames names={option.items} />
    </span>
  );
}

/** One option row: label, items, "Last time" when it was the last pick; nothing preselected. */
export function OptionList({
  slot,
  selectedOptionId,
  lastUsedOptionId,
  onPick,
  name,
}: {
  slot: RubricSlot;
  selectedOptionId: string | null;
  lastUsedOptionId: string | null;
  onPick: (optionId: string) => void;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label={t('meal.compose.chooseOption')} className="space-y-1.5">
      {sortedOptions(slot).map((option, index) => {
        const selected = option.id === selectedOptionId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            data-testid={`option-${slot.id}-${index + 1}`}
            onClick={() => onPick(option.id)}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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
                <span className="text-sm font-medium">{t('plan.option.n', { n: index + 1 })}</span>
                {option.id === lastUsedOptionId ? (
                  <Badge variant="secondary">{t('meal.compose.lastTime')}</Badge>
                ) : null}
              </span>
              <OptionItems option={option} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Today's planned meals" row (compose step): one chip per slot in plan
 * order. A single-option slot logs on tap; a multi-option slot expands its
 * options beneath the row, the last-used one marked "Last time". A slot
 * already recorded today carries a check (O D14) and stays selectable.
 */
export function PlannedSlotsRow({
  slots,
  lastUsed,
  recordedSlotIds = [],
  initialExpandedSlotId = null,
  onExpand,
  onPick,
}: {
  slots: RubricSlot[];
  lastUsed: Record<string, string | null>;
  recordedSlotIds?: readonly string[];
  initialExpandedSlotId?: string | null;
  onExpand: (slotId: string) => void;
  onPick: (slotId: string, optionId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(initialExpandedSlotId);
  const open = slots.find((s) => s.id === expanded) ?? null;
  return (
    <div className="space-y-2">
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
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-start',
                isOpen ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent',
              )}
            >
              <span className="flex flex-col">
                <span className="flex items-center gap-1.5">
                  <NameLabel
                    originalName={slot.originalName}
                    englishLabel={slot.englishLabel}
                    size="sm"
                  />
                  {recorded ? (
                    <span
                      className="grid size-4 shrink-0 place-content-center rounded-full bg-primary/15 text-primary"
                      data-testid="slot-recorded"
                    >
                      <Check className="size-3" aria-hidden="true" />
                      <span className="sr-only">{t('meal.compose.slotRecorded')}</span>
                    </span>
                  ) : null}
                </span>
                {multi ? (
                  <span className="text-xs text-muted-foreground">
                    {tp('meal.compose.optionCount', options.length)}
                  </span>
                ) : options[0] ? (
                  <OptionItems option={options[0]} />
                ) : null}
              </span>
              {multi ? (
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
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
        <div className="rounded-xl border border-border bg-card p-3" data-testid="slot-options">
          <p className="mb-2 text-sm font-medium">{t('meal.compose.chooseOption')}</p>
          <OptionList
            slot={open}
            selectedOptionId={null}
            lastUsedOptionId={lastUsed[open.id] ?? null}
            onPick={(optionId) => onPick(open.id, optionId)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Slot picker for "More details", the review summary and "Change plan link":
 * the day's plan slots plus "Other · in addition to your plan"; a multi-option
 * slot then lists its options.
 */
export function SlotSelect({
  slots,
  slotId,
  optionId,
  lastUsed,
  onChange,
  idPrefix,
}: {
  slots: RubricSlot[];
  /** null = not chosen yet, OTHER_SLOT = explicitly "Other". */
  slotId: string | null;
  optionId: string | null;
  lastUsed: Record<string, string | null>;
  onChange: (slotId: string | null, optionId: string | null) => void;
  idPrefix: string;
}) {
  const selected = slots.find((s) => s.id === slotId) ?? null;
  const showOptions = selected !== null && selected.options.length > 1;
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-slot`}>{t('meal.compose.slot')}</Label>
      <div className="relative">
        <select
          id={`${idPrefix}-slot`}
          data-testid="slot-select"
          className="h-11 w-full appearance-none rounded-md border border-input bg-transparent px-3 pe-9 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
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
