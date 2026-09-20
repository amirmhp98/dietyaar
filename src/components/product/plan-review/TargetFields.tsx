'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { t } from '@/lib/t';
import { TARGET_NUTRIENTS, TARGET_TYPES, type DraftTarget } from '@/lib/validations/plan';
import { QuantityInput } from './SlotEditor';
import { newKey, nutrientLabel, nutrientUnit } from './helpers';

/**
 * Editable daily-target rows (7b "Fix" and the manual wizard): nutrient,
 * kind, and the one or two values the kind needs. Editing an estimated
 * target makes it explicit — the user's figure wins from then on.
 */

export function newTarget(weekday: number | null = null): DraftTarget {
  return {
    key: newKey(),
    slotKey: null,
    weekday,
    nutrient: 'ENERGY_KCAL',
    type: 'RANGE',
    low: null,
    high: null,
    source: 'EXPLICIT',
    sourceExcerpt: null,
  };
}

/** True when the values satisfy the kind (mirrors the zod refinement). */
export function targetComplete(target: DraftTarget): boolean {
  const { type, low, high } = target;
  if (type === 'RANGE') return low !== null && high !== null && low <= high;
  if (type === 'MAXIMUM') return high !== null;
  return low !== null;
}

export function TargetFields({
  target,
  onChange,
  onRemove,
  lockNutrient = false,
}: {
  target: DraftTarget;
  onChange: (target: DraftTarget) => void;
  onRemove?: () => void;
  /** Per-meal ranges keep their nutrient and kind; only the values change. */
  lockNutrient?: boolean;
}) {
  const unit = nutrientUnit(target.nutrient);
  const explicit = (patch: Partial<DraftTarget>) =>
    onChange({ ...target, ...patch, source: 'EXPLICIT' });
  const needsLow = target.type !== 'MAXIMUM';
  const needsHigh = target.type === 'RANGE' || target.type === 'MAXIMUM';
  const invalid = !targetComplete(target);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      {lockNutrient ? null : (
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('plan.target.nutrient')}>
            <Select
              value={target.nutrient}
              onValueChange={(nutrient) =>
                explicit({ nutrient: nutrient as DraftTarget['nutrient'] })
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_NUTRIENTS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {nutrientLabel(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('plan.target.type')}>
            <Select
              value={target.type}
              onValueChange={(type) => explicit({ type: type as DraftTarget['type'] })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`plan.targetType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )}
      <div className="flex items-end gap-3">
        {needsLow ? (
          <FormField
            className="flex-1"
            label={`${needsHigh ? t('plan.target.low') : t('plan.target.value')} (${unit})`}
            error={invalid && target.low === null ? t('validation.targetValue') : undefined}
          >
            <QuantityInput
              key={`${target.key}-low`}
              value={target.low}
              onChange={(low) => explicit({ low })}
            />
          </FormField>
        ) : null}
        {needsHigh ? (
          <FormField
            className="flex-1"
            label={`${needsLow ? t('plan.target.high') : t('plan.target.value')} (${unit})`}
            error={
              invalid && (target.high === null || (target.low ?? 0) > target.high)
                ? t('validation.targetRange')
                : undefined
            }
          >
            <QuantityInput
              key={`${target.key}-high`}
              value={target.high}
              onChange={(high) => explicit({ high })}
            />
          </FormField>
        ) : null}
        {onRemove ? (
          <IconAction
            label={t('plan.target.remove')}
            icon={Trash2}
            className="shrink-0"
            onClick={onRemove}
          />
        ) : null}
      </div>
    </div>
  );
}

export function AddTargetButton({ onAdd }: { onAdd: () => void }) {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onAdd}>
      <Plus aria-hidden="true" />
      {t('plan.target.add')}
    </Button>
  );
}
