'use client';

import { useMemo, useState } from 'react';
import { CloudOff, Plus } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Label, Textarea } from '@/components/UiComponents';
import { DifferenceChip } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { NameLabel } from '@/components/product/NameLabel';
import { ItemRow } from '@/components/product/meal/ItemRow';
import { QuestionCard } from '@/components/product/meal/QuestionCard';
import { OTHER_SLOT, SlotSelect, optionLabel } from '@/components/product/meal/SlotPicker';
import { NUTRIENT_UNITS, sumTotals } from '@/components/product/meal/totals';
import { formatNumber } from '@/lib/format';
import type { MatchResult, RubricSlot } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import type { DraftFoodItem, MealDraftState } from '@/lib/validations/meal';
import { MAIN_NUTRIENTS } from '@/lib/validations/nutrition';
import { cn } from '@/lib/utils';

export type ReviewSyncStatus = 'saved' | 'pending' | 'failed';

export interface MealReviewProps {
  /** `draft`: the composer (slot change allowed); `edit`: a saved meal (slot changes go through the details page). */
  mode: 'draft' | 'edit';
  state: MealDraftState;
  onChange: (patch: Partial<MealDraftState>) => void;
  match: MatchResult | null;
  slots: RubricSlot[];
  lastUsed: Record<string, string | null>;
  /** True when the user explicitly picked "Other" (kept client-side; the server only knows null). */
  otherChosen: boolean;
  sync: ReviewSyncStatus;
  online: boolean;
  conflict: boolean;
  saving: boolean;
  /** Inline message under the primary action (save failure, option required, future time). */
  error: string | null;
  canReestimate: boolean;
  onReestimate: () => void;
  onSave: () => void;
  onReload: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  dateSummary: string;
  today: string;
}

let newItemSeq = 0;
export function newDraftItem(position: number): DraftFoodItem {
  newItemSeq += 1;
  return {
    key: `new-${Date.now().toString(36)}-${newItemSeq}`,
    position,
    originalName: '',
    englishLabel: '',
    quantity: null,
    unit: null,
    quantityUnknown: false,
    quantityAssumed: false,
    preparation: null,
    category: 'OTHER',
    alternatives: [],
    chosenAlternative: null,
    nutrition: null,
    matchedPlanItemId: null,
    isAddedItem: false,
    needsReestimate: false,
    previousNutrition: null,
    scaleFlag: null,
    ruleGroups: [],
  };
}

function matchLabel(
  match: MatchResult,
  slots: RubricSlot[],
): { text: string; reason: string | null } {
  const text = t(`meal.review.match.${match.status}`);
  if (!match.reason) return { text, reason: null };
  if (match.reason === 'CROSS_SLOT') {
    const slot = match.crossSlot;
    const name = slot
      ? (slots.find((s) => s.englishLabel === slot.englishLabel)?.englishLabel ?? slot.englishLabel)
      : '';
    return { text, reason: t('meal.review.reason.CROSS_SLOT', { slot: name.toLowerCase() }) };
  }
  return { text, reason: t(`meal.review.reason.${match.reason}`) };
}

/**
 * "Check your meal" (design-scope screen 4 row 2, product spec § 7 "AI
 * review"): editable items, grouped questions, reminders, totals computed
 * from the items, sources, and the slot summary. All state lives in the
 * island; this component only renders and reports edits.
 */
export function MealReview(props: MealReviewProps) {
  const {
    mode,
    state,
    onChange,
    match,
    slots,
    lastUsed,
    otherChosen,
    sync,
    online,
    conflict,
    saving,
    error,
    canReestimate,
    onReestimate,
    onSave,
    onReload,
    onCancel,
    dateSummary,
    today,
  } = props;
  const [changingSlot, setChangingSlot] = useState(false);
  const [timeUnknown, setTimeUnknown] = useState(state.time === null);
  const totals = useMemo(() => sumTotals(state.items), [state.items]);
  const slot = slots.find((s) => s.id === state.planSlotId) ?? null;
  const option = slot?.options.find((o) => o.id === state.planOptionId) ?? null;
  const optionIndex = slot
    ? [...slot.options]
        .sort((a, b) => a.position - b.position)
        .findIndex((o) => o.id === option?.id)
    : -1;
  const optionRequired = slot !== null && slot.options.length > 1 && option === null;
  const hitByKey = new Map(state.restrictionHits.map((h) => [h.itemKey, h.restriction]));
  const addedNames = match?.added.map((a) => a.englishLabel) ?? [];
  const backdated = state.localDate !== today;
  const saveDisabled = saving || optionRequired || conflict;
  const slotSummary = match ? matchLabel(match, slots) : null;

  function updateItem(index: number, next: DraftFoodItem) {
    onChange({ items: state.items.map((it, i) => (i === index ? next : it)) });
  }
  function removeItem(index: number) {
    onChange({
      items: state.items.filter((_, i) => i !== index).map((it, i) => ({ ...it, position: i })),
    });
  }
  function addItem() {
    onChange({ items: [...state.items, newDraftItem(state.items.length)] });
  }
  function answer(key: string, value: string | null) {
    onChange({
      questions: state.questions.map((q) => (q.key === key ? { ...q, answer: value } : q)),
    });
  }

  return (
    <div className="space-y-4" data-testid="meal-review">
      <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        <p className="text-sm text-muted-foreground">{t('meal.review.helper')}</p>
        <SyncIndicator sync={sync} online={online} />
      </div>

      {conflict ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning bg-warning/10 p-3 text-sm"
          data-testid="conflict-banner"
        >
          <span>{t('meal.errors.conflict')}</span>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onReload}>
            {t('meal.review.reload')}
          </Button>
        </div>
      ) : null}

      {state.text ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t('meal.review.youWrote')}: </span>
          <bdi>{state.text}</bdi>
        </p>
      ) : null}

      {state.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t('meal.review.noItems')}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="meal-items">
          {state.items.map((item, index) => (
            <ItemRow
              key={item.key}
              item={item}
              index={index}
              restrictionHit={hitByKey.get(item.key) ?? null}
              canReestimate={canReestimate}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
              onReestimate={onReestimate}
            />
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={addItem}
        data-testid="add-item"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('meal.review.addItem')}
      </Button>

      <QuestionCard questions={state.questions} items={state.items} onAnswer={answer} />

      {addedNames.length > 0 ? (
        <div>
          <DifferenceChip kind="ADDED">
            {t('meal.review.added', { names: addedNames.join(', ') })}
          </DifferenceChip>
        </div>
      ) : null}

      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-labelledby="meal-totals-title"
      >
        <h3 id="meal-totals-title" className="text-sm font-semibold">
          {t('meal.review.totals')}
        </h3>
        <dl className="mt-2 grid grid-cols-4 gap-2" data-testid="meal-totals">
          {MAIN_NUTRIENTS.map((key) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t(`meal.nutrient.${key}`)}</dt>
              <dd className="text-base font-semibold tabular-nums" dir="ltr">
                {totals.values[key] === null
                  ? t('meal.nutrient.unknown')
                  : `${formatNumber(totals.values[key], { maximumFractionDigits: 0 })} ${t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`)}`}
              </dd>
            </div>
          ))}
        </dl>
        {totals.incomplete ? (
          <p
            className="mt-2 text-sm text-muted-foreground"
            role="status"
            data-testid="unknown-values"
          >
            <span className="font-medium text-foreground">{t('meal.review.unknownValues')}.</span>{' '}
            {t('meal.review.unknownValuesHint')}
          </p>
        ) : null}
        <Disclosure label={t('meal.review.sources')} className="mt-2" testId="sources-toggle">
          <ul className="space-y-1 text-sm">
            {state.items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-baseline gap-x-2">
                <NameLabel
                  originalName={item.originalName || t('meal.review.newItem')}
                  englishLabel={item.englishLabel}
                  inline
                  size="sm"
                />
                <span className="text-muted-foreground">
                  {item.nutrition
                    ? `${t(`meal.review.source.${item.nutrition.source}`)}${item.nutrition.sourceRef ? ` · ${item.nutrition.sourceRef}` : ''}`
                    : t('meal.review.sourceNone')}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 space-y-3"
        aria-labelledby="meal-slot-title"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="meal-slot-title" className="text-sm font-semibold">
            {t('meal.review.slot')}
          </h3>
          {mode === 'draft' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setChangingSlot((v) => !v)}
              aria-expanded={changingSlot}
              data-testid="change-link"
            >
              {t('meal.review.change')}
            </Button>
          ) : null}
        </div>
        {changingSlot && mode === 'draft' ? (
          <SlotSelect
            slots={slots}
            slotId={state.planSlotId ?? (otherChosen ? OTHER_SLOT : null)}
            optionId={state.planOptionId}
            lastUsed={lastUsed}
            idPrefix="review"
            onChange={(slotId, optionId) =>
              onChange({
                planSlotId: slotId === OTHER_SLOT ? null : slotId,
                planOptionId: slotId === OTHER_SLOT ? null : optionId,
              })
            }
          />
        ) : (
          <div className="space-y-1 text-sm" data-testid="slot-summary">
            {slot ? (
              <div className="flex flex-wrap items-center gap-2">
                <NameLabel
                  originalName={slot.originalName}
                  englishLabel={slot.englishLabel}
                  inline
                  size="sm"
                />
                {option ? (
                  <Badge variant="secondary">
                    <bdi>{optionLabel(option, optionIndex)}</bdi>
                  </Badge>
                ) : null}
              </div>
            ) : (
              <p>
                {otherChosen || mode === 'edit'
                  ? t('meal.compose.slotOther')
                  : t('meal.compose.slotNone')}
              </p>
            )}
            {slotSummary ? (
              <p className="text-muted-foreground">
                {slotSummary.text}
                {slotSummary.reason ? ` · ${slotSummary.reason}` : ''}
              </p>
            ) : null}
          </div>
        )}
        {optionRequired && !changingSlot && slot ? (
          <div className="space-y-2" data-testid="option-required">
            <p className="text-sm text-warning" role="status">
              {t('meal.review.chooseOption')}
            </p>
            <SlotSelect
              slots={slots}
              slotId={slot.id}
              optionId={null}
              lastUsed={lastUsed}
              idPrefix="review-option"
              onChange={(slotId, optionId) =>
                onChange({
                  planSlotId: slotId === OTHER_SLOT ? null : slotId,
                  planOptionId: slotId === OTHER_SLOT ? null : optionId,
                })
              }
            />
          </div>
        ) : null}
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 space-y-3"
        aria-labelledby="meal-time-title"
      >
        <h3 id="meal-time-title" className="text-sm font-semibold">
          {t('meal.review.dateTime')}
        </h3>
        <p className="text-sm" data-testid="date-summary">
          {dateSummary}
        </p>
        {backdated ? (
          <p className="text-sm text-muted-foreground">{t('meal.compose.confirmTime')}</p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="review-date" className="text-xs">
              {t('meal.compose.date')}
            </Label>
            <Input
              id="review-date"
              type="date"
              className="h-11 w-44"
              dir="ltr"
              max={today}
              value={state.localDate}
              onChange={(event) => {
                if (event.target.value) onChange({ localDate: event.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-time" className="text-xs">
              {t('meal.compose.time')}
            </Label>
            <Input
              id="review-time"
              type="time"
              className="h-11 w-32"
              dir="ltr"
              disabled={timeUnknown}
              value={state.time ?? ''}
              onChange={(event) => {
                if (event.target.value) onChange({ time: event.target.value });
              }}
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              checked={timeUnknown}
              data-testid="time-unknown"
              onCheckedChange={(checked) => {
                const unknown = checked === true;
                setTimeUnknown(unknown);
                onChange({ time: unknown ? null : state.time });
              }}
            />
            {t('meal.compose.timeUnknown')}
          </label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="review-notes" className="text-xs">
            {t('meal.compose.notes')}
          </Label>
          <Textarea
            id="review-notes"
            dir="auto"
            rows={2}
            maxLength={1000}
            placeholder={t('meal.compose.notesPlaceholder')}
            value={state.notes ?? ''}
            onChange={(event) => onChange({ notes: event.target.value || null })}
          />
        </div>
      </section>

      <div className="space-y-2 pb-1">
        {error ? (
          <p role="alert" className="text-sm text-error" data-testid="save-error">
            {error}
          </p>
        ) : null}
        <div className={cn('flex gap-2', onCancel ? 'flex-row' : 'flex-col')}>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={onCancel}
              disabled={saving}
            >
              {t('meal.details.cancel')}
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-11 flex-1"
            onClick={onSave}
            disabled={saveDisabled}
            aria-disabled={saveDisabled}
            data-testid="save-meal"
          >
            {saving ? t('meal.review.saving') : (props.saveLabel ?? t('meal.review.save'))}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SyncIndicator({ sync, online }: { sync: ReviewSyncStatus; online: boolean }) {
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warning" data-testid="offline">
        <CloudOff className="size-3.5" aria-hidden="true" />
        {t('meal.review.offline')}
      </span>
    );
  }
  if (sync === 'saved') return null;
  return (
    <Badge variant={sync === 'failed' ? 'warning' : 'outline'} data-testid="unsaved">
      {t('meal.review.unsaved')}
    </Badge>
  );
}
