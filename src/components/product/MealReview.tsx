'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Check, CirclePlus, CloudOff, Flame, Pencil, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Spinner,
  Textarea,
} from '@/components/UiComponents';
import { DifferenceChip } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { IconAction } from '@/components/product/IconAction';
import { InlineName, InlineNames, fillNames } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';
import { SectionHeader } from '@/components/product/SectionHeader';
import { StatusGlyph, type StatusGlyphName } from '@/components/product/StatusGlyph';
import { Surface } from '@/components/product/Surface';
import { ItemRow } from '@/components/product/meal/ItemRow';
import type { StagedPhoto } from '@/components/product/meal/PhotoPicker';
import { PhotoThumbnails } from '@/components/product/meal/PhotoThumbnails';
import { QuestionCard } from '@/components/product/meal/QuestionCard';
import { ResumedBanner } from '@/components/product/meal/ResumedBanner';
import { OTHER_SLOT, OptionList, SlotSelect } from '@/components/product/meal/SlotPicker';
import { newDraftItem } from '@/components/product/meal/composition';
import { quantityFromChoice } from '@/components/product/meal/questions';
import { reviewGate } from '@/components/product/meal/review-state';
import { NUTRIENT_UNITS, sumTotals } from '@/components/product/meal/totals';
import { formatNumber } from '@/lib/format';
import type { MatchResult, MatchStatus, RubricSlot } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import type { DraftFoodItem, MealDraftState } from '@/lib/validations/meal';
import { MAIN_NUTRIENTS } from '@/lib/validations/nutrition';
import { cn } from '@/lib/utils';

/** `refining`: a REFINE call is in flight; the review stays usable meanwhile. */
export type ReviewSyncStatus = 'saved' | 'pending' | 'failed' | 'refining';

export interface MealReviewProps {
  /** `draft`: the composer (slot change allowed); `edit`: a saved meal (slot changes go through the details page). */
  mode: 'draft' | 'edit';
  state: MealDraftState;
  onChange: (patch: Partial<MealDraftState>) => void;
  /** Called after a question was answered so the island can refine the estimate. */
  onAnswered?: () => void;
  match: MatchResult | null;
  slots: RubricSlot[];
  lastUsed: Record<string, string | null>;
  /** True when the user explicitly picked "Other" (kept client-side; the server only knows null). */
  otherChosen: boolean;
  /** The suggested slot that already held a meal, when that is why the meal became an extra one (B4). */
  extraBecauseRecordedSlotId?: string | null;
  /** Staged photos of the draft (B5). */
  photos?: StagedPhoto[];
  sync: ReviewSyncStatus;
  online: boolean;
  conflict: boolean;
  saving: boolean;
  /** Inline message under the primary action (save failure, option required, future time). */
  error: string | null;
  /** A failed refine: the answer is kept, Re-estimate is offered again. */
  refineError?: string | null;
  canReestimate: boolean;
  onReestimate: () => void;
  onSave: () => void;
  onReload: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  dateSummary: string;
  today: string;
  /** Lifted by the composer so the compose step and the review agree; local otherwise (edit mode). */
  timeUnknown?: boolean;
  onTimeUnknownChange?: (unknown: boolean) => void;
  /** The sheet opened on a draft from before (B8). */
  resumed?: boolean;
  onStartOver?: () => void;
  /**
   * `inline` (default) renders the footer — slot link, date summary, Save —
   * under the body; `external` leaves it to the caller, who renders
   * `MealReviewFooter` with the same props in a pinned slot (D2c).
   */
  footer?: 'inline' | 'external';
}

const MATCH_GLYPH: Record<MatchStatus, StatusGlyphName> = {
  MATCHED: 'RECORDED',
  PARTLY_MATCHED: 'PARTLY',
  DIFFERENT_FOOD: 'DIFFERENT',
};

function matchLabel(match: MatchResult): { text: string; reason: ReactNode | null } {
  const text = t(`meal.review.match.${match.status}`);
  if (!match.reason) return { text, reason: null };
  if (match.reason === 'CROSS_SLOT') {
    return {
      text,
      reason: match.crossSlot
        ? fillNames(t('meal.review.reason.CROSS_SLOT', { slot: '{slot}' }), {
            slot: <InlineName name={match.crossSlot} />,
          })
        : null,
    };
  }
  return { text, reason: t(`meal.review.reason.${match.reason}`) };
}

/**
 * "Check your meal" (design-scope screen 4 row 2, product spec § 7 "AI
 * review", D2b): the photos, one compact row per item that expands into its
 * editor, the grouped questions, the totals strip with what changed and the
 * sources, and date/time/notes under "More details". All state lives in the
 * island; this component only renders and reports edits. The footer —
 * slot link, date summary, Save — is `MealReviewFooter`.
 */
export function MealReview(props: MealReviewProps) {
  const {
    state,
    onChange,
    onAnswered,
    match,
    slots,
    photos = [],
    sync,
    online,
    conflict,
    saving,
    refineError = null,
    canReestimate,
    onReestimate,
    onReload,
    today,
    resumed = false,
    onStartOver,
    footer = 'inline',
  } = props;
  const [localTimeUnknown, setLocalTimeUnknown] = useState(state.time === null);
  const timeUnknown = props.timeUnknown ?? localTimeUnknown;
  const totals = useMemo(() => sumTotals(state.items), [state.items]);
  const gate = reviewGate({ state, slots, today, timeUnknown });
  const hitByKey = new Map(state.restrictionHits.map((h) => [h.itemKey, h.restriction]));
  const askedKeys = new Set(
    state.questions.filter((q) => q.itemKey && !q.answer).map((q) => q.itemKey),
  );
  const added = match?.added ?? [];
  const [moreOpen, setMoreOpen] = useState(false);
  // What is needed to save accurately stays visible (product spec § 7): a
  // backdated day or a missing time keeps the details open.
  const detailsOpen = moreOpen || gate.backdated || gate.timeRequired;

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
  function setTimeUnknown(unknown: boolean) {
    setLocalTimeUnknown(unknown);
    props.onTimeUnknownChange?.(unknown);
    // Unticking leaves the field empty; a time is typed, never invented (B6).
    onChange({ time: null });
  }
  /** A picked choice (a chip, never free text) naming a count of a known unit fills the quantity at once (B2). */
  function answer(key: string, value: string | null, committed: boolean) {
    const question = state.questions.find((q) => q.key === key);
    const patch: Partial<MealDraftState> = {
      questions: state.questions.map((q) => (q.key === key ? { ...q, answer: value } : q)),
    };
    const item = question?.itemKey ? state.items.find((i) => i.key === question.itemKey) : null;
    const parsed =
      item && value && question?.choices.includes(value) ? quantityFromChoice(value, item) : null;
    if (parsed) {
      patch.items = state.items.map((it) =>
        it === item
          ? {
              ...it,
              quantity: parsed.quantity,
              unit: parsed.unit,
              unitGrams: parsed.unitGrams,
              quantityUnknown: false,
              quantityAssumed: false,
            }
          : it,
      );
    }
    onChange(patch);
    if (value && committed) onAnswered?.();
  }

  return (
    <div className="space-y-4" data-testid="meal-review">
      {resumed && onStartOver ? (
        <ResumedBanner onStartOver={onStartOver} disabled={saving} />
      ) : null}

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
          <Button type="button" variant="outline" size="sm" onClick={onReload}>
            {t('meal.review.reload')}
          </Button>
        </div>
      ) : null}

      {refineError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning bg-warning/10 p-3 text-sm"
          data-testid="refine-failed"
        >
          <span>{refineError}</span>
          <Button type="button" variant="outline" size="sm" onClick={onReestimate}>
            {t('meal.compose.retry')}
          </Button>
        </div>
      ) : null}

      <PhotoThumbnails photos={photos} />

      {state.text ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t('meal.review.youWrote')}: </span>
          <bdi>{state.text}</bdi>
        </p>
      ) : null}

      <div className="space-y-2">
        {state.items.length === 0 ? (
          <Surface variant="note" rule>
            <p className="text-sm text-muted-foreground">{t('meal.review.noItems')}</p>
          </Surface>
        ) : (
          <Surface variant="list" as="ul" data-testid="meal-items">
            {state.items.map((item, index) => (
              <ItemRow
                key={item.key}
                item={item}
                index={index}
                restrictionHit={hitByKey.get(item.key) ?? null}
                asked={askedKeys.has(item.key)}
                canReestimate={canReestimate}
                onChange={(next) => updateItem(index, next)}
                onRemove={() => removeItem(index)}
                onReestimate={onReestimate}
              />
            ))}
          </Surface>
        )}
        <Button
          type="button"
          variant="ghost"
          className="-ms-2 text-muted-foreground"
          onClick={addItem}
          data-testid="add-item"
        >
          <Plus aria-hidden="true" />
          {t('meal.review.addItem')}
        </Button>
      </div>

      <QuestionCard questions={state.questions} items={state.items} onAnswer={answer} />

      {added.length > 0 ? (
        <div>
          <DifferenceChip kind="ADDED">
            {fillNames(t('meal.review.added', { names: '{names}' }), {
              names: <InlineNames names={added} />,
            })}
          </DifferenceChip>
        </div>
      ) : null}

      <Surface
        variant="note"
        as="section"
        padding="sm"
        aria-labelledby="meal-totals-title"
        className="space-y-2"
      >
        <SectionHeader
          icon={Flame}
          title={t('meal.review.totals')}
          level={3}
          id="meal-totals-title"
        />
        <dl className="grid grid-cols-4 gap-2" data-testid="meal-totals">
          {MAIN_NUTRIENTS.map((key) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t(`meal.nutrient.${key}`)}</dt>
              <dd className="font-display text-base font-semibold tabular-nums" dir="ltr">
                {totals.values[key] === null
                  ? t('meal.nutrient.unknown')
                  : `${formatNumber(totals.values[key], { maximumFractionDigits: 0 })} ${t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`)}`}
              </dd>
            </div>
          ))}
        </dl>
        {totals.incomplete ? (
          <p className="text-sm text-muted-foreground" role="status" data-testid="unknown-values">
            <span className="font-medium text-foreground">{t('meal.review.unknownValues')}.</span>{' '}
            {t('meal.review.unknownValuesHint')}
          </p>
        ) : null}
        {state.lastChanges.length > 0 ? (
          <div className="text-sm text-muted-foreground" data-testid="what-changed">
            <p className="text-xs font-medium text-foreground">{t('meal.review.whatChanged')}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-4">
              {state.lastChanges.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Disclosure label={t('meal.review.sources')} testId="sources-toggle">
          <ul className="space-y-1 text-sm">
            {state.items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-baseline gap-x-2">
                <NameLabel originalName={item.originalName || t('meal.review.newItem')} size="sm" />
                <span className="text-muted-foreground">
                  {item.nutrition
                    ? `${t(`meal.review.source.${item.nutrition.source}`)}${item.nutrition.sourceRef ? ` · ${item.nutrition.sourceRef}` : ''}`
                    : t('meal.review.sourceNone')}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      </Surface>

      <Disclosure
        label={t('meal.compose.moreDetails')}
        open={detailsOpen}
        onOpenChange={setMoreOpen}
        testId="review-more-details"
      >
        <div className="space-y-3 pt-1">
          {gate.backdated ? (
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
                onChange={(event) => onChange({ time: event.target.value || null })}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={timeUnknown}
                data-testid="time-unknown"
                onCheckedChange={(checked) => setTimeUnknown(checked === true)}
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
        </div>
      </Disclosure>

      {footer === 'inline' ? (
        <MealReviewFooter
          {...props}
          timeUnknown={timeUnknown}
          onTimeUnknownChange={setTimeUnknown}
        />
      ) : null}
    </div>
  );
}

/**
 * The review's pinned footer (D2c): the slot sentence with its glyph and
 * the Change action, the option chooser when one is owed, the date/time
 * summary with the refining pill, the reason Save is held back, and Save
 * meal — the one filled primary in the sheet.
 */
export function MealReviewFooter(props: MealReviewProps) {
  const {
    mode,
    state,
    onChange,
    match,
    slots,
    lastUsed,
    otherChosen,
    extraBecauseRecordedSlotId = null,
    sync,
    conflict,
    saving,
    error,
    onSave,
    onCancel,
    dateSummary,
    today,
  } = props;
  const [changingSlot, setChangingSlot] = useState(false);
  const timeUnknown = props.timeUnknown ?? state.time === null;
  const gate = reviewGate({ state, slots, today, timeUnknown });
  const { slot, option, optionN, optionRequired, timeRequired } = gate;
  const extraSlot = slots.find((s) => s.id === extraBecauseRecordedSlotId) ?? null;
  const saveDisabled = saving || optionRequired || conflict || timeRequired;
  const slotSummary = match ? matchLabel(match) : null;
  const changing = changingSlot && mode === 'draft';

  function setLink(slotId: string | null, optionId: string | null) {
    onChange({
      planSlotId: slotId === OTHER_SLOT ? null : slotId,
      planOptionId: slotId === OTHER_SLOT ? null : optionId,
    });
  }

  let sentence: ReactNode;
  let glyph: ReactNode;
  if (slot) {
    sentence = (
      <>
        {fillNames(
          t(option || optionRequired ? 'meal.review.linkedTo' : 'meal.review.linkedDifferent', {
            slot: '{slot}',
          }),
          { slot: <InlineName name={slot} /> },
        )}
        {optionN !== null && slot.options.length > 1 ? (
          <>
            {' · '}
            {t('plan.option.n', { n: optionN })}
          </>
        ) : null}
      </>
    );
    const status: StatusGlyphName = optionRequired
      ? 'NEEDS_REVIEW'
      : match
        ? MATCH_GLYPH[match.status]
        : option
          ? 'RECORDED'
          : 'DIFFERENT';
    glyph = <StatusGlyph status={status} describe={false} />;
  } else {
    sentence = extraSlot
      ? fillNames(t('meal.review.extraBecauseRecorded', { slot: '{slot}' }), {
          slot: <InlineName name={extraSlot} />,
        })
      : t('meal.review.extraMeal');
    glyph = (
      <span className="inline-flex shrink-0 items-center justify-center text-foreground">
        <CirclePlus className="size-5" aria-hidden="true" />
      </span>
    );
  }

  const changeAction =
    mode === 'draft' ? (
      <IconAction
        label={t('meal.review.change')}
        icon={Pencil}
        aria-expanded={changing}
        onClick={() => setChangingSlot((v) => !v)}
        disabled={saving}
        data-testid="change-link"
      />
    ) : null;

  return (
    <div className="space-y-2" data-testid="review-footer">
      {changing ? (
        <SlotSelect
          slots={slots}
          slotId={state.planSlotId ?? (otherChosen ? OTHER_SLOT : null)}
          optionId={state.planOptionId}
          lastUsed={lastUsed}
          idPrefix="review"
          onChange={setLink}
          trailing={changeAction}
        />
      ) : (
        <div className="flex min-h-11 items-center gap-2" data-testid="slot-summary">
          {glyph}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate">{sentence}</p>
            {slotSummary ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {slotSummary.text}
                {slotSummary.reason ? <> · {slotSummary.reason}</> : null}
              </p>
            ) : null}
          </div>
          {changeAction}
        </div>
      )}
      {optionRequired && !changing && slot ? (
        <div className="space-y-2" data-testid="option-required">
          <p className="text-sm text-warning" role="status">
            {t('meal.review.chooseOption')}
          </p>
          <OptionList
            slot={slot}
            selectedOptionId={null}
            lastUsedOptionId={lastUsed[slot.id] ?? null}
            onPick={(optionId) => setLink(slot.id, optionId)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          data-testid="date-summary"
        >
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          {dateSummary}
        </p>
        {sync === 'refining' ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            role="status"
            data-testid="refining"
          >
            <Spinner className="size-3.5" />
            {t('meal.review.refining')}
          </span>
        ) : null}
      </div>
      {timeRequired ? (
        <p className="text-sm text-warning" role="status" data-testid="time-required">
          {t('meal.review.timeRequired')}
        </p>
      ) : null}
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
            className="flex-1"
            onClick={onCancel}
            disabled={saving}
          >
            {t('meal.details.cancel')}
          </Button>
        ) : null}
        <Button
          type="button"
          className="flex-1"
          onClick={onSave}
          disabled={saveDisabled}
          aria-disabled={saveDisabled}
          data-testid="save-meal"
        >
          {saving ? <Spinner /> : <Check aria-hidden="true" />}
          {saving ? t('meal.review.saving') : (props.saveLabel ?? t('meal.review.save'))}
        </Button>
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
  if (sync === 'saved' || sync === 'refining') return null;
  return (
    <Badge variant={sync === 'failed' ? 'warning' : 'outline'} data-testid="unsaved">
      {t('meal.review.unsaved')}
    </Badge>
  );
}
