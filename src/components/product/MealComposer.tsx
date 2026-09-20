'use client';

import type { ReactNode } from 'react';
import { CalendarDays, History, PencilLine, Sparkles, Sun, Utensils } from 'lucide-react';
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
import { InlineName, InlineNames } from '@/components/product/InlineName';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { PhotoPicker, type StagedPhoto } from '@/components/product/meal/PhotoPicker';
import { ResumedBanner } from '@/components/product/meal/ResumedBanner';
import {
  OTHER_SLOT,
  OptionList,
  PlannedSlotsRow,
  SlotSelect,
} from '@/components/product/meal/SlotPicker';
import { composeLayout, timeMissing } from '@/components/product/meal/composition';
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
  /** The slot the sheet opened for (a slot row): its options lead the compose step (D2a). */
  openedSlotId: string | null;
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
  backdatedLabel: string | null;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  analysis: AnalysisStatus;
  /** Message for the failed state (product spec § 12 rows). */
  analysisError: string | null;
  onManual: () => void;
  onRetry: () => void;
  busy: boolean;
}

/** Text and photos are ready to check: something to send, nothing in flight. */
export function canCheckMeal(input: {
  text: string;
  photos: readonly unknown[];
  busy: boolean;
  photoBusy: boolean;
}): boolean {
  return (
    (input.text.trim().length > 0 || input.photos.length > 0) && !input.busy && !input.photoBusy
  );
}

/**
 * Compose step of Log meal (design-scope screen 4, D2a): opened from a slot
 * row the slot's options lead, then "Something else?" with the text box and
 * photos, then Recent when there is any; opened from the button the text
 * box leads, then the day's planned slots as chips, then Recent. "More
 * details" (date, time, slot, notes) closes the step. Stateless: the island
 * owns every value and calls the actions; the footer is `MealComposerFooter`.
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
    openedSlotId,
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
    onManual,
    onRetry,
    busy,
  } = props;
  const canAnalyze = canCheckMeal({ text, photos, busy, photoBusy });
  const openedSlot = slots?.find((s) => s.id === openedSlotId) ?? null;
  const layout = composeLayout({ openedSlot, recentCount: recent === null ? null : recent.length });
  const optionsFirst = layout[0] === 'options';

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
            <Button type="button" variant="outline" onClick={onManual}>
              <PencilLine aria-hidden="true" />
              {t('meal.compose.enterManually')}
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  const blocks: Record<(typeof layout)[number], ReactNode> = {
    options: openedSlot ? (
      <section aria-labelledby="opened-slot-title" className="space-y-3">
        <SectionHeader
          icon={Utensils}
          title={<InlineName name={openedSlot} />}
          level={3}
          id="opened-slot-title"
        />
        <OptionList
          slot={openedSlot}
          selectedOptionId={null}
          lastUsedOptionId={lastUsed[openedSlot.id] ?? null}
          onPick={(id) => onPickPlanned(openedSlot.id, id)}
          testId="slot-options"
        />
      </section>
    ) : null,
    input: (
      <section aria-labelledby="composer-text-title" className="space-y-3">
        {optionsFirst ? (
          <SectionHeader
            icon={PencilLine}
            title={t('meal.compose.somethingElse')}
            level={3}
            id="composer-text-title"
          />
        ) : (
          <h3 id="composer-text-title" className="sr-only">
            {t('meal.compose.textLabel')}
          </h3>
        )}
        <div>
          <Label htmlFor="composer-text" className="sr-only">
            {t('meal.compose.textLabel')}
          </Label>
          <Textarea
            id="composer-text"
            dir="auto"
            rows={3}
            maxLength={MEAL_TEXT_MAX}
            placeholder={
              optionsFirst
                ? t('meal.compose.textPlaceholderElse')
                : t('meal.compose.textPlaceholder')
            }
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
      </section>
    ),
    planned: (
      <section aria-labelledby="planned-title" className="space-y-3">
        <SectionHeader
          icon={Sun}
          title={
            localDate === today ? t('meal.compose.plannedToday') : t('meal.compose.plannedTitle')
          }
          level={3}
          id="planned-title"
        />
        {slots === null ? (
          <div className="flex gap-2">
            <Skeleton className="h-11 w-36 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        ) : !hasPlan || slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('meal.compose.plannedEmpty')}</p>
        ) : (
          <PlannedSlotsRow
            slots={slots}
            lastUsed={lastUsed}
            recordedSlotIds={recordedSlotIds}
            onExpand={onExpandSlot}
            onPick={onPickPlanned}
          />
        )}
      </section>
    ),
    recent: (
      <section aria-labelledby="recent-title" className="space-y-3">
        <SectionHeader
          icon={History}
          title={t('meal.compose.recentTitle')}
          level={3}
          id="recent-title"
        />
        {recent === null ? (
          <div className="flex gap-2">
            <Skeleton className="h-11 w-40 rounded-full" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        ) : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="recent-meals">
            {recent.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => onPickRecent(meal.id)}
                disabled={busy}
                data-testid="recent-meal"
                className="flex min-h-11 max-w-64 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-start transition-colors hover:bg-tint-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="truncate text-sm font-medium">
                  <InlineNames names={meal.items.slice(0, 3)} />
                </span>
                {meal.energyKcal !== null ? (
                  <span
                    className="shrink-0 font-display text-xs tabular-nums text-muted-foreground"
                    dir="ltr"
                  >
                    {formatNumber(meal.energyKcal)} {t('meal.nutrient.unit.kcal')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>
    ),
  };

  return (
    <div className="space-y-6">
      {resumed ? <ResumedBanner onStartOver={onStartOver} disabled={busy} /> : null}

      {backdatedLabel ? (
        <Surface
          variant="note"
          padding="sm"
          className="flex items-center gap-2 text-sm font-medium"
          role="status"
        >
          <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span data-testid="logging-for">{backdatedLabel}</span>
        </Surface>
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
              size="sm"
              onClick={onRetry}
              disabled={!canAnalyze}
            >
              {t('meal.compose.retry')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onManual} disabled={busy}>
              {t('meal.compose.enterManually')}
            </Button>
          </div>
        </div>
      ) : null}

      {layout.map((block) => (
        <div key={block}>{blocks[block]}</div>
      ))}

      <Disclosure
        label={t('meal.compose.moreDetails')}
        open={moreOpen}
        onOpenChange={onMoreOpenChange}
        testId="more-details"
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
    </div>
  );
}

/**
 * The compose step's pinned footer: the date/time summary, "Check this
 * meal" (outline — the sheet's one filled primary is Save meal on the
 * review) and "Enter manually".
 */
export function MealComposerFooter({
  dateSummary,
  canAnalyze,
  busy,
  photoBusy,
  onAnalyze,
  onManual,
}: {
  dateSummary: string;
  canAnalyze: boolean;
  busy: boolean;
  photoBusy: boolean;
  onAnalyze: () => void;
  onManual: () => void;
}) {
  return (
    <div className="space-y-2">
      <p
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        data-testid="date-summary"
      >
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        {dateSummary}
      </p>
      {/* Secondary at the start, the affirmative action at the end (platform convention). */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="shrink-0"
          onClick={onManual}
          disabled={busy || photoBusy}
          data-testid="enter-manually"
        >
          <PencilLine aria-hidden="true" />
          {t('meal.compose.enterManually')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          data-testid="analyze"
        >
          {busy ? <Spinner /> : <Sparkles aria-hidden="true" />}
          {t('meal.compose.analyze')}
        </Button>
      </div>
    </div>
  );
}
