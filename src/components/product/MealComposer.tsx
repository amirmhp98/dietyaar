'use client';

import {
  Button,
  Checkbox,
  Input,
  Label,
  Skeleton,
  Spinner,
  Textarea,
} from '@/components/UiComponents';
import { Disclosure } from '@/components/product/Disclosure';
import { NameLabel } from '@/components/product/NameLabel';
import { PhotoPicker, type StagedPhoto } from '@/components/product/meal/PhotoPicker';
import { ResumedBanner } from '@/components/product/meal/ResumedBanner';
import { OTHER_SLOT, PlannedSlotsRow, SlotSelect } from '@/components/product/meal/SlotPicker';
import { timeMissing } from '@/components/product/meal/composition';
import { formatNumber } from '@/lib/format';
import type { RubricSlot } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { MEAL_TEXT_MAX } from '@/lib/validations/meal';

export interface ComposerRecentMeal {
  id: string;
  items: Array<{ originalName: string; englishLabel: string }>;
  energyKcal: number | null;
}

export type AnalysisStatus = 'idle' | 'running' | 'slow' | 'failed';

export interface MealComposerProps {
  text: string;
  onTextChange: (text: string) => void;
  photosEnabled: boolean;
  photos: StagedPhoto[];
  photoBusy: boolean;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (uploadId: string) => void;
  /** null while loading. */
  recent: ComposerRecentMeal[] | null;
  onPickRecent: (mealId: string) => void;
  /** null while loading. */
  slots: RubricSlot[] | null;
  hasPlan: boolean;
  lastUsed: Record<string, string | null>;
  /** Slots that already hold a meal on this date (marked on the chips). */
  recordedSlotIds: readonly string[];
  onExpandSlot: (slotId: string) => void;
  onPickPlanned: (slotId: string, optionId: string) => void;
  /** Slot to show expanded when the composer opened for a multi-option slot. */
  initialExpandedSlotId: string | null;
  /** null = not chosen, OTHER_SLOT = explicitly "Other". */
  slotChoice: string | null;
  optionId: string | null;
  onSlotChange: (slotChoice: string | null, optionId: string | null) => void;
  localDate: string;
  today: string;
  /** null = not entered; whether that means "unknown" is `timeUnknown`. */
  time: string | null;
  timeUnknown: boolean;
  onDateChange: (localDate: string) => void;
  onTimeChange: (time: string | null) => void;
  onTimeUnknownChange: (unknown: boolean) => void;
  /** The sheet opened on a draft from before; Start over discards it. */
  resumed: boolean;
  onStartOver: () => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  dateSummary: string;
  backdatedLabel: string | null;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  analysis: AnalysisStatus;
  /** Message for the failed state (product spec § 12 rows). */
  analysisError: string | null;
  onAnalyze: () => void;
  onManual: () => void;
  onRetry: () => void;
  busy: boolean;
}

function recentLabel(meal: ComposerRecentMeal): string {
  return meal.items
    .slice(0, 3)
    .map((i) => i.englishLabel)
    .join(', ');
}

/**
 * Compose step of Log meal (design-scope screen 4): description, photos,
 * Recent meals, the day's planned slots, More details, and the primary
 * actions. Stateless: the island owns every value and calls the actions.
 */
export function MealComposer(props: MealComposerProps) {
  const {
    text,
    onTextChange,
    photosEnabled,
    photos,
    photoBusy,
    onAddPhotos,
    onRemovePhoto,
    recent,
    onPickRecent,
    slots,
    hasPlan,
    lastUsed,
    recordedSlotIds,
    onExpandSlot,
    onPickPlanned,
    initialExpandedSlotId,
    slotChoice,
    optionId,
    onSlotChange,
    localDate,
    today,
    time,
    timeUnknown,
    onDateChange,
    onTimeChange,
    onTimeUnknownChange,
    resumed,
    onStartOver,
    notes,
    onNotesChange,
    backdatedLabel,
    moreOpen,
    onMoreOpenChange,
    analysis,
    analysisError,
    onAnalyze,
    onManual,
    onRetry,
    busy,
  } = props;
  const canAnalyze = (text.trim().length > 0 || photos.length > 0) && !busy && !photoBusy;

  if (analysis === 'running' || analysis === 'slow') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="analyzing">
        <Spinner className="size-8" />
        <p className="text-base font-medium" role="status" aria-live="polite">
          {analysis === 'slow' ? t('meal.compose.analyzingSlow') : t('meal.compose.analyzing')}
        </p>
        {analysis === 'slow' ? (
          <>
            <p className="text-sm text-muted-foreground">{t('meal.compose.analyzingHint')}</p>
            <Button type="button" variant="outline" className="h-11" onClick={onManual}>
              {t('meal.compose.enterManually')}
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {resumed ? <ResumedBanner onStartOver={onStartOver} disabled={busy} /> : null}

      {backdatedLabel ? (
        <p
          className="rounded-xl border border-info/40 bg-info/10 px-3 py-2 text-sm font-medium"
          data-testid="logging-for"
          role="status"
        >
          {backdatedLabel}
        </p>
      ) : null}

      {analysis === 'failed' && analysisError ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-warning bg-warning/10 p-3 text-sm"
          data-testid="analysis-failed"
        >
          <p>{analysisError}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={onRetry}
              disabled={!canAnalyze}
            >
              {t('meal.compose.retry')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={onManual}
              disabled={busy}
            >
              {t('meal.compose.enterManually')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="composer-text">{t('meal.compose.textLabel')}</Label>
        <Textarea
          id="composer-text"
          dir="auto"
          rows={3}
          maxLength={MEAL_TEXT_MAX}
          placeholder={t('meal.compose.textPlaceholder')}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          data-testid="composer-text"
          className="text-base"
        />
      </div>

      {photosEnabled ? (
        <PhotoPicker
          photos={photos}
          busy={photoBusy}
          onAdd={onAddPhotos}
          onRemove={onRemovePhoto}
        />
      ) : null}

      <section aria-labelledby="recent-title" className="space-y-2">
        <h3 id="recent-title" className="text-sm font-semibold">
          {t('meal.compose.recentTitle')}
        </h3>
        {recent === null ? (
          <div className="flex gap-2">
            <Skeleton className="h-11 w-40 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('meal.compose.recentEmpty')}</p>
        ) : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="recent-meals">
            {recent.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => onPickRecent(meal.id)}
                disabled={busy}
                data-testid="recent-meal"
                className="flex min-h-11 max-w-64 shrink-0 flex-col items-start rounded-xl border border-border bg-card px-3 py-2 text-start hover:bg-accent"
              >
                {meal.items[0] ? (
                  <NameLabel
                    originalName={meal.items[0].originalName}
                    englishLabel={recentLabel(meal)}
                    size="sm"
                    className="max-w-full items-start"
                  />
                ) : null}
                {meal.energyKcal !== null ? (
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {formatNumber(meal.energyKcal)} {t('meal.nutrient.unit.kcal')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="planned-title" className="space-y-2">
        <h3 id="planned-title" className="text-sm font-semibold">
          {localDate === today ? t('meal.compose.plannedToday') : t('meal.compose.plannedTitle')}
        </h3>
        {slots === null ? (
          <div className="flex gap-2">
            <Skeleton className="h-14 w-36 rounded-xl" />
            <Skeleton className="h-14 w-36 rounded-xl" />
          </div>
        ) : !hasPlan || slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('meal.compose.plannedEmpty')}</p>
        ) : (
          <PlannedSlotsRow
            slots={slots}
            lastUsed={lastUsed}
            recordedSlotIds={recordedSlotIds}
            initialExpandedSlotId={initialExpandedSlotId}
            onExpand={onExpandSlot}
            onPick={onPickPlanned}
          />
        )}
      </section>

      <Disclosure
        label={t('meal.compose.moreDetails')}
        open={moreOpen}
        onOpenChange={onMoreOpenChange}
        testId="more-details"
        className="rounded-xl border border-border bg-card px-3 py-1"
      >
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="composer-date" className="text-xs">
                {t('meal.compose.date')}
              </Label>
              <Input
                id="composer-date"
                type="date"
                className="h-11 w-44"
                dir="ltr"
                max={today}
                value={localDate}
                onChange={(event) => {
                  if (event.target.value) onDateChange(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="composer-time" className="text-xs">
                {t('meal.compose.time')}
              </Label>
              <Input
                id="composer-time"
                type="time"
                className="h-11 w-32"
                dir="ltr"
                disabled={timeUnknown}
                value={time ?? ''}
                onChange={(event) => onTimeChange(event.target.value || null)}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={timeUnknown}
                data-testid="time-unknown"
                onCheckedChange={(checked) => onTimeUnknownChange(checked === true)}
              />
              {t('meal.compose.timeUnknown')}
            </label>
          </div>
          {timeMissing(time, timeUnknown) ? (
            <p className="text-sm text-muted-foreground" role="status" data-testid="time-required">
              {t('meal.review.timeRequired')}
            </p>
          ) : null}
          {localDate !== today ? (
            <p className="text-sm text-muted-foreground">{t('meal.compose.confirmTime')}</p>
          ) : null}
          <SlotSelect
            slots={slots ?? []}
            slotId={slotChoice}
            optionId={optionId}
            lastUsed={lastUsed}
            idPrefix="composer"
            onChange={(slotId, option) => {
              if (slotId && slotId !== OTHER_SLOT) onExpandSlot(slotId);
              onSlotChange(slotId, option);
            }}
          />
          <div className="space-y-1">
            <Label htmlFor="composer-notes" className="text-xs">
              {t('meal.compose.notes')}
            </Label>
            <Textarea
              id="composer-notes"
              dir="auto"
              rows={2}
              maxLength={1000}
              placeholder={t('meal.compose.notesPlaceholder')}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </div>
        </div>
      </Disclosure>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground" data-testid="date-summary">
          {props.dateSummary}
        </p>
        <Button
          type="button"
          className="h-11 w-full"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          data-testid="analyze"
        >
          {busy ? <Spinner className="size-4" /> : null}
          {t('meal.compose.analyze')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={onManual}
          disabled={busy || photoBusy}
          data-testid="enter-manually"
        >
          {t('meal.compose.enterManually')}
        </Button>
      </div>
    </div>
  );
}
