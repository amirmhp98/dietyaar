'use client';

import { useId, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { UNITS, unitByKey } from '@/lib/units';
import type { DraftFoodItem } from '@/lib/validations/meal';
import { MAIN_NUTRIENTS, type Nutrition, type NutritionValues } from '@/lib/validations/nutrition';
import { cn } from '@/lib/utils';
import { LabelValuesPopover } from './LabelValuesPopover';
import { NUTRIENT_UNITS, portionValues } from './totals';

const NO_UNIT = '__none';

function parseQuantity(raw: string): number | null {
  const text = normalizeDigits(raw).trim().replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "210 kcal · P 8 g · C 30 g · F 5 g" for one item, or null when nothing is known. */
export function valuesLine(values: NutritionValues | null): string | null {
  if (!values) return null;
  const parts = MAIN_NUTRIENTS.map((key) => {
    const v = values[key];
    const unit = t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`);
    const label = key === 'ENERGY_KCAL' ? '' : `${t(`meal.nutrient.${key}`).charAt(0)} `;
    return `${label}${v === null || v === undefined ? t('meal.nutrient.unknown') : formatNumber(v, { maximumFractionDigits: 1 })} ${unit}`;
  });
  return parts.join(' · ');
}

/**
 * One item on "Check your meal" (product spec § 7 "AI review"): name, tags,
 * quantity + unit, values, flags and reminders. Editing identity or
 * preparation makes the server mark it `needsReestimate`; the previous
 * values stay visible struck through until re-estimated.
 */
export function ItemRow({
  item,
  index,
  restrictionHit,
  canReestimate,
  onChange,
  onRemove,
  onReestimate,
}: {
  item: DraftFoodItem;
  index: number;
  restrictionHit: string | null;
  canReestimate: boolean;
  onChange: (next: DraftFoodItem) => void;
  onRemove: () => void;
  onReestimate: () => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(item.originalName.trim() === '');
  const [quantityText, setQuantityText] = useState(
    item.quantity === null ? '' : String(item.quantity),
  );
  // A reload or a server-side rescale can change the quantity underneath the field.
  const [syncedQuantity, setSyncedQuantity] = useState(item.quantity);
  if (syncedQuantity !== item.quantity) {
    setSyncedQuantity(item.quantity);
    if (parseQuantity(quantityText) !== item.quantity) {
      setQuantityText(item.quantity === null ? '' : String(item.quantity));
    }
  }
  const values = portionValues(item);
  const previous = item.needsReestimate ? valuesLine(item.previousNutrition?.values ?? null) : null;
  const unitKnown = item.unit === null || unitByKey(item.unit) !== undefined;
  const isLabel = item.nutrition?.source === 'USER_LABEL';
  const isEstimate = !!item.nutrition && item.nutrition.isEstimate && !isLabel;
  const displayName = item.originalName.trim() || t('meal.review.newItem');

  function patch(partial: Partial<DraftFoodItem>) {
    onChange({ ...item, ...partial });
  }

  function chooseAlternative(index: number) {
    const alt = item.alternatives[index];
    if (!alt) return;
    let alternatives = item.alternatives;
    // Keep the identified name reachable: it joins the list the first time the user switches.
    if (item.chosenAlternative === null) {
      const identified = {
        originalName: item.originalName,
        englishLabel: item.englishLabel,
        nutrition: item.nutrition,
      };
      alternatives =
        alternatives.length >= 6
          ? [...alternatives.slice(0, 5), identified]
          : [...alternatives, identified];
    }
    patch({
      originalName: alt.originalName,
      englishLabel: alt.englishLabel,
      chosenAlternative: index,
      alternatives,
    });
  }

  function applyLabel(nutrition: Nutrition) {
    patch({ nutrition, needsReestimate: false, previousNutrition: null, scaleFlag: null });
  }

  return (
    <li
      className="rounded-xl border border-border bg-card p-3"
      data-testid={`meal-item-${index + 1}`}
      aria-label={t('meal.review.item', { number: index + 1 })}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <NameLabel originalName={displayName} />
          {item.preparation ? (
            <p className="text-xs text-muted-foreground">
              <bdi>{item.preparation}</bdi>
            </p>
          ) : null}
          {isEstimate || item.quantityAssumed || isLabel ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {isEstimate ? <Badge variant="outline">{t('meal.review.estimated')}</Badge> : null}
              {item.quantityAssumed ? (
                <Badge variant="outline">{t('meal.review.assumed')}</Badge>
              ) : null}
              {isLabel ? <Badge variant="secondary">{t('meal.review.labelValues')}</Badge> : null}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t('meal.review.editItem', { name: displayName })}
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t('meal.review.removeItem', { name: displayName })}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className="w-20 space-y-1">
          <Label htmlFor={`${id}-qty`} className="text-xs">
            {t('meal.review.quantity')}
          </Label>
          <Input
            id={`${id}-qty`}
            inputMode="decimal"
            dir="ltr"
            className="h-11"
            value={quantityText}
            disabled={item.quantityUnknown}
            data-testid="item-quantity"
            onChange={(event) => {
              setQuantityText(event.target.value);
              const quantity = parseQuantity(event.target.value);
              patch({ quantity, quantityAssumed: false });
            }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${id}-unit`} className="text-xs">
            {t('meal.review.unit')}
          </Label>
          <Select
            value={item.unit ?? NO_UNIT}
            onValueChange={(value) => patch({ unit: value === NO_UNIT ? null : value })}
          >
            <SelectTrigger id={`${id}-unit`} className="h-11" data-testid="item-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_UNIT}>{t('meal.review.unitNone')}</SelectItem>
              {!unitKnown && item.unit ? (
                <SelectItem value={item.unit}>
                  <bdi>{item.unit}</bdi>
                </SelectItem>
              ) : null}
              {UNITS.map((unit) => (
                <SelectItem key={unit.key} value={unit.key}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
          <Checkbox
            checked={item.quantityUnknown}
            onCheckedChange={(checked) => patch({ quantityUnknown: checked === true })}
          />
          {t('meal.review.quantityUnknown')}
        </label>
      </div>

      <div className="mt-2 space-y-1 text-sm">
        {previous ? (
          <p className="text-muted-foreground">
            <span className="sr-only">{t('meal.review.previousValues')}: </span>
            <s dir="ltr">{previous}</s>
          </p>
        ) : null}
        <p
          className={cn(item.nutrition ? 'text-foreground' : 'text-muted-foreground')}
          dir="ltr"
          data-testid="item-values"
        >
          {valuesLine(values) ?? t('meal.review.sourceNone')}
        </p>
        {item.originalName.trim() === '' ? (
          <p className="text-warning" role="status">
            {t('meal.review.nameRequired')}
          </p>
        ) : null}
        {item.scaleFlag === 'CHECK_VALUE' ? (
          <p className="text-warning" role="status">
            {t('meal.review.checkValue')}
          </p>
        ) : null}
        {item.needsReestimate ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-warning" role="status">
              {t('meal.review.needsReestimate')}
            </span>
            {canReestimate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={onReestimate}
              >
                {t('meal.review.reestimate')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {restrictionHit ? (
          <p className="text-foreground" data-testid="restriction-line">
            {t('meal.review.restriction', { item: restrictionHit })}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <Label htmlFor={`${id}-name`} className="text-xs">
              {t('meal.review.name')}
            </Label>
            <Input
              id={`${id}-name`}
              dir="auto"
              className="h-11"
              placeholder={t('meal.review.namePlaceholder')}
              value={item.originalName}
              maxLength={200}
              data-testid="item-name"
              onChange={(event) => patch({ originalName: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-prep`} className="text-xs">
              {t('meal.review.preparation')}
            </Label>
            <Input
              id={`${id}-prep`}
              dir="auto"
              className="h-11"
              placeholder={t('meal.review.preparationPlaceholder')}
              value={item.preparation ?? ''}
              maxLength={200}
              onChange={(event) => patch({ preparation: event.target.value || null })}
            />
          </div>
          {item.alternatives.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">{t('meal.review.alternatives')}</p>
              <div
                role="radiogroup"
                aria-label={t('meal.review.alternatives')}
                className="flex flex-wrap gap-2"
              >
                {item.alternatives.map((alt, i) => {
                  const selected = item.chosenAlternative === i;
                  return (
                    <button
                      key={`${alt.englishLabel}-${i}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseAlternative(i)}
                      className={cn(
                        'min-h-11 rounded-full border px-3 text-sm',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-accent',
                      )}
                    >
                      <NameLabel
                        originalName={alt.originalName}
                        englishLabel={alt.englishLabel}
                        size="sm"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <LabelValuesPopover
              current={item.nutrition}
              basisQuantity={item.quantityUnknown ? null : item.quantity}
              basisUnit={item.unit}
              onApply={applyLabel}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setEditing(false)}
            >
              {t('meal.review.doneEditing')}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
