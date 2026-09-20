'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
import { IconAction } from '@/components/product/IconAction';
import { AmountPrefix, GramsEach } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { UNITS, isCountUnit, unitByKey, unitLabel } from '@/lib/units';
import type { DraftFoodItem } from '@/lib/validations/meal';
import { MAIN_NUTRIENTS, type Nutrition, type NutritionValues } from '@/lib/validations/nutrition';
import { cn } from '@/lib/utils';
import { LabelValuesPopover } from './LabelValuesPopover';
import { NUTRIENT_UNITS, portionValues } from './totals';

const NO_UNIT = '__none';
/** The stepper of a counted item moves by one and never below half a piece. */
const COUNT_STEP = 1;
const COUNT_MIN = 0.5;

function parseQuantity(raw: string): number | null {
  const text = normalizeDigits(raw).trim().replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseGrams(raw: string): number | null {
  const n = parseQuantity(raw);
  return n !== null && n > 0 ? n : null;
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
 * An item opens on its editor when something about it needs the user
 * (product spec § 7: progressive disclosure is for optional detail, not for
 * what is needed to save accurately): a blank name, a value to check, a
 * pending re-estimate, or an unknown quantity that no open question is
 * already asking about — the question block is the shorter way to answer.
 */
export function needsAttention(item: DraftFoodItem, asked = false): boolean {
  return (
    item.originalName.trim() === '' ||
    (item.quantityUnknown && !asked) ||
    item.scaleFlag === 'CHECK_VALUE' ||
    item.needsReestimate
  );
}

/**
 * One item on "Check your meal" (D2b): a compact row — amount · name ·
 * energy · chevron — that expands into the editor (quantity stepper or
 * field, unit, unknown, grams each, name, preparation, alternatives, label
 * values, re-estimate, remove). Badges appear only when they say something:
 * Assumed, Label value, Needs a new estimate, Check this value. Editing
 * identity or preparation makes the server mark it `needsReestimate`; the
 * previous values stay visible struck through until re-estimated.
 */
export function ItemRow({
  item,
  index,
  restrictionHit,
  asked = false,
  canReestimate,
  onChange,
  onRemove,
  onReestimate,
}: {
  item: DraftFoodItem;
  index: number;
  restrictionHit: string | null;
  /** An unanswered question in the questions block targets this item. */
  asked?: boolean;
  canReestimate: boolean;
  onChange: (next: DraftFoodItem) => void;
  onRemove: () => void;
  onReestimate: () => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(() => needsAttention(item, asked));
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
  const [gramsText, setGramsText] = useState(item.unitGrams === null ? '' : String(item.unitGrams));
  const [syncedGrams, setSyncedGrams] = useState(item.unitGrams);
  if (syncedGrams !== item.unitGrams) {
    setSyncedGrams(item.unitGrams);
    if (parseGrams(gramsText) !== item.unitGrams) {
      setGramsText(item.unitGrams === null ? '' : String(item.unitGrams));
    }
  }
  const values = portionValues(item);
  const previous = item.needsReestimate ? valuesLine(item.previousNutrition?.values ?? null) : null;
  const unitKnown = item.unit === null || unitByKey(item.unit) !== undefined;
  const counted = isCountUnit(item.unit);
  const isLabel = item.nutrition?.source === 'USER_LABEL';
  const displayName = item.originalName.trim() || t('meal.review.newItem');
  const kcal = values?.ENERGY_KCAL ?? null;
  const hasBadges =
    item.quantityAssumed || isLabel || item.needsReestimate || item.scaleFlag === 'CHECK_VALUE';
  const editorId = `${id}-editor`;

  function patch(partial: Partial<DraftFoodItem>) {
    onChange({ ...item, ...partial });
  }

  function setQuantity(quantity: number | null) {
    patch({ quantity, quantityAssumed: false });
  }

  /** −/+ on a counted item: whole steps, never below half a piece. */
  function step(direction: -1 | 1) {
    const next = Math.max(COUNT_MIN, (item.quantity ?? 0) + direction * COUNT_STEP);
    setQuantityText(String(next));
    setQuantity(next);
  }

  /** A change of measure drops the grams per unit; the next estimate fills them for a count. */
  function setUnit(unit: string | null) {
    patch({ unit, unitGrams: isCountUnit(unit) && unit === item.unit ? item.unitGrams : null });
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

  const quantityField = (
    <Input
      id={`${id}-qty`}
      inputMode="decimal"
      dir="ltr"
      className={cn('h-11', counted ? 'w-14 text-center' : 'w-full')}
      value={quantityText}
      disabled={item.quantityUnknown}
      data-testid="item-quantity"
      onChange={(event) => {
        setQuantityText(event.target.value);
        setQuantity(parseQuantity(event.target.value));
      }}
    />
  );

  return (
    <li
      className="px-3"
      data-testid={`meal-item-${index + 1}`}
      aria-label={t('meal.review.item', { number: index + 1 })}
    >
      <div className="flex min-h-14 items-center gap-3 py-2">
        {/* The chevron is the accessible control; the text is a convenience target. */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing((v) => !v)}>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <AmountPrefix
              quantity={item.quantityUnknown ? null : item.quantity}
              unit={item.unit}
              className="text-base"
            />
            <NameLabel originalName={displayName} />
            <GramsEach unit={item.unit} unitGrams={item.unitGrams} />
          </div>
          {item.preparation ? (
            <p className="text-xs text-muted-foreground">
              <bdi>{item.preparation}</bdi>
            </p>
          ) : null}
          {hasBadges ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.quantityAssumed ? (
                <Badge variant="outline">{t('meal.review.assumed')}</Badge>
              ) : null}
              {isLabel ? <Badge variant="secondary">{t('meal.review.labelValues')}</Badge> : null}
              {item.needsReestimate ? (
                <Badge variant="warning">{t('meal.review.needsReestimate')}</Badge>
              ) : null}
              {item.scaleFlag === 'CHECK_VALUE' ? (
                <Badge variant="warning">{t('meal.review.checkValue')}</Badge>
              ) : null}
            </div>
          ) : null}
          {restrictionHit ? (
            <p className="mt-1 text-xs text-foreground" data-testid="restriction-line">
              {t('meal.review.restriction', { item: restrictionHit })}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 font-display text-sm tabular-nums',
            kcal === null ? 'text-muted-foreground' : 'text-foreground',
          )}
          dir="ltr"
          data-testid="item-kcal"
        >
          {kcal === null
            ? t('meal.nutrient.unknown')
            : `${formatNumber(kcal, { maximumFractionDigits: 0 })} ${t('meal.nutrient.unit.kcal')}`}
        </span>
        {item.needsReestimate && canReestimate ? (
          <IconAction
            label={t('meal.review.reestimate')}
            icon={RefreshCw}
            variant="outline"
            onClick={onReestimate}
          />
        ) : null}
        <IconAction
          label={t('meal.review.editItem', { name: displayName })}
          icon={ChevronDown}
          aria-expanded={editing}
          aria-controls={editorId}
          className={cn('-me-2 transition-transform duration-200', editing && 'rotate-180')}
          onClick={() => setEditing((v) => !v)}
        />
      </div>

      {editing ? (
        <div id={editorId} className="space-y-3 pb-3" data-testid="item-editor">
          <div className="flex flex-wrap items-end gap-2">
            <div className={cn('space-y-1', counted ? 'shrink-0' : 'w-20')}>
              <Label htmlFor={`${id}-qty`} className="text-xs">
                {t('meal.review.quantity')}
              </Label>
              {counted ? (
                <div className="flex items-center gap-1" data-testid="item-stepper">
                  <IconAction
                    label={t('unit.quantity.decrease')}
                    icon={Minus}
                    variant="outline"
                    disabled={item.quantityUnknown || (item.quantity ?? 0) <= COUNT_MIN}
                    onClick={() => step(-1)}
                  />
                  {quantityField}
                  <IconAction
                    label={t('unit.quantity.increase')}
                    icon={Plus}
                    variant="outline"
                    disabled={item.quantityUnknown}
                    onClick={() => step(1)}
                  />
                </div>
              ) : (
                quantityField
              )}
            </div>
            <div className="min-w-24 flex-1 space-y-1">
              <Label htmlFor={`${id}-unit`} className="text-xs">
                {t('meal.review.unit')}
              </Label>
              <Select
                value={item.unit ?? NO_UNIT}
                onValueChange={(value) => setUnit(value === NO_UNIT ? null : value)}
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
                      {unitLabel(unit.key)}
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
          {counted && !item.quantityUnknown ? (
            <div className="flex items-center gap-2 text-sm" data-testid="item-grams-each">
              <span aria-hidden="true">≈</span>
              <Input
                id={`${id}-each`}
                inputMode="decimal"
                dir="ltr"
                className="h-9 w-20"
                aria-label={t('unit.gramsEach.label')}
                value={gramsText}
                onChange={(event) => {
                  setGramsText(event.target.value);
                  patch({ unitGrams: parseGrams(event.target.value) });
                }}
              />
              <Label
                htmlFor={`${id}-each`}
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
              >
                {t('unit.gramsEach.suffix')}
              </Label>
            </div>
          ) : null}

          <div className="space-y-1 text-sm">
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
          </div>

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
                        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        selected
                          ? 'border-primary bg-tint-2'
                          : 'border-border bg-background hover:bg-tint-1',
                      )}
                    >
                      {selected ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
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
            <IconAction
              label={t('meal.review.removeItem', { name: displayName })}
              icon={Trash2}
              variant="outline"
              size="dense"
              onClick={onRemove}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-auto"
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
