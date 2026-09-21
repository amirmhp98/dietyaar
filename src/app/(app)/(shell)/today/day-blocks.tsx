'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { Camera, ChevronRight, ClipboardList, Plus, Sun, Utensils } from 'lucide-react';
import { markSlotSkippedAction, setDayCompletenessAction } from '@/actions/day.actions';
import { Button, toast } from '@/components/UiComponents';
import { CompletenessCheckbox } from '@/components/product/CompletenessCheckbox';
import { Illustration } from '@/components/product/Illustration';
import { InlineName, InlineNames } from '@/components/product/InlineName';
import { NutritionDetails } from '@/components/product/NutritionDetails';
import { PlanSlotRow } from '@/components/product/PlanSlotRow';
import { ScoreCard } from '@/components/product/ScoreCard';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { WhyThisScore } from '@/components/product/WhyThisScore';
import { useComposerOpener } from '@/components/product/composer-bus';
import { formatLocalDate, formatNumber, formatTime } from '@/lib/format';
import type { DayView, SlotView } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';
import { instantFor } from '@/lib/time/local-date';
import type { MealSummary } from '@/services/day-view.service';
import { ReflectionCardIsland } from '../reflection-card';

export interface DayBlocksProps {
  localDate: string;
  /** The zone the day was computed in (historical days keep their own). */
  zone: string;
  view: DayView;
  meals: MealSummary[];
  /** A plan draft is pending, ready or failed: the banner speaks, not the "Add your plan" card. */
  draftPending: boolean;
  /**
   * Today only: the day's reflection card, first while unread and last (above
   * the completeness checkbox) once "Got it" was tapped for the date.
   */
  reflection?: { acknowledged: boolean };
}

/**
 * The Today blocks (product spec § 9, design.md "Product UI"), reused by the
 * History day page with another `localDate`: the reflection (Today only),
 * Your plan today (the hero score card, the slot rows in a list surface,
 * nutrition details), Recorded meals, and the completeness checkbox. Data
 * comes from the server page; skip and unskip flip the row optimistically
 * before their action resolves, and the page re-renders. The blocks are a
 * keyed list so "Got it" re-orders the reflection without remounting it.
 */
export function DayBlocks({
  localDate,
  zone,
  view,
  meals,
  draftPending,
  reflection,
}: DayBlocksProps) {
  const ongoing = view.dayPhase === 'ONGOING';
  const openComposer = useComposerOpener();
  const [pending, startTransition] = useTransition();
  const [logComplete, setOptimisticComplete] = useOptimistic(view.logComplete);
  const [slots, setOptimisticSlot] = useOptimistic(
    view.slots,
    (current: SlotView[], change: { planSlotId: string; skipped: boolean }) =>
      current.map((s): SlotView =>
        s.slot.id === change.planSlotId
          ? { ...s, state: change.skipped ? 'SKIPPED' : 'NOT_RECORDED' }
          : s,
      ),
  );
  const [reflectionAcknowledged, setReflectionAcknowledged] = useState(
    reflection?.acknowledged ?? false,
  );

  function skip(planSlotId: string, skipped: boolean) {
    startTransition(async () => {
      setOptimisticSlot({ planSlotId, skipped });
      const result = await markSlotSkippedAction({ localDate, planSlotId, skipped });
      if (!result.ok) toast.error(result.error);
    });
  }

  function setComplete(complete: boolean) {
    startTransition(async () => {
      setOptimisticComplete(complete);
      const result = await setDayCompletenessAction({ localDate, complete });
      if (!result.ok) toast.error(result.error);
    });
  }

  const hasPlan = view.planStructure !== null;
  const targetsOnly = view.planStructure === 'TARGETS_ONLY';
  // The first open or passed unrecorded slot; before any window opens (early morning), the first unrecorded one.
  const unrecorded = slots.filter((s) => s.state === 'NOT_RECORDED');
  const nextSlot = unrecorded.find((s) => s.windowState !== 'UPCOMING') ?? unrecorded[0] ?? null;
  const allDone = slots.length > 0 && nextSlot === null;
  const { coverage } = view.score;
  const gaps = !ongoing && logComplete && view.mealCount > 0 && coverage.notRecorded > 0;
  const helper = gaps
    ? t('day.completeness.gaps', { recorded: coverage.recorded, total: coverage.prescribed })
    : undefined;
  const dateLabel = formatLocalDate(localDate, { month: 'short', day: 'numeric' });

  const reflectionBlock = reflection ? (
    <ReflectionCardIsland
      key="reflection"
      localDate={localDate}
      acknowledged={reflectionAcknowledged}
      onAcknowledged={() => setReflectionAcknowledged(true)}
    />
  ) : null;

  const nutrition = (
    <NutritionDetails
      nutrition={view.nutrition}
      mealCount={view.mealCount}
      logComplete={logComplete}
      ongoing={ongoing}
    />
  );

  const blocks = [
    reflectionAcknowledged ? null : reflectionBlock,
    <section key="plan" className="space-y-3" aria-labelledby="plan-block-title">
      <SectionHeader
        id="plan-block-title"
        icon={Sun}
        title={ongoing ? t('day.plan.heading') : t('day.plan.headingPast', { date: dateLabel })}
      />

      {!hasPlan ? (
        <Surface
          variant="note"
          className="flex flex-col items-center gap-3 text-center"
          data-testid="no-plan-card"
        >
          <Illustration name="noPlan" size={96} />
          <p className="max-w-prose text-sm">{t('day.plan.noPlan')}</p>
          {!draftPending ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/plan/add">
                <ClipboardList aria-hidden="true" />
                {t('day.plan.addPlan')}
              </Link>
            </Button>
          ) : null}
        </Surface>
      ) : targetsOnly ? (
        <Surface variant="note" className="space-y-3">
          <p className="text-sm text-muted-foreground" data-testid="targets-only">
            {t('day.plan.targetsOnly')}
          </p>
          {nutrition}
          <PlanLink />
        </Surface>
      ) : (
        <>
          <ScoreCard score={view.score} ongoing={ongoing}>
            <WhyThisScore view={view} className="mt-2" />
          </ScoreCard>
          <Surface variant="list">
            <ul className="divide-y divide-border" data-testid="plan-slots">
              {slots.map((slot) => (
                <PlanSlotRow
                  key={slot.slot.id}
                  slot={slot}
                  highlighted={nextSlot?.slot.id === slot.slot.id}
                  ongoing={ongoing}
                  pending={pending}
                  onLog={() => openComposer({ planSlotId: slot.slot.id, localDate })}
                  onSkip={(skipped) => skip(slot.slot.id, skipped)}
                  reviewHref={slot.mealIds[0] ? `/meals/${slot.mealIds[0]}` : undefined}
                />
              ))}
            </ul>
            <div className="space-y-2 p-3">
              {allDone ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => openComposer({ localDate })}
                  data-testid="log-another-meal"
                >
                  <Plus aria-hidden="true" />
                  {t('day.plan.logAnother')}
                </Button>
              ) : null}
              {nutrition}
              <PlanLink />
            </div>
          </Surface>
        </>
      )}
    </section>,
    <section key="meals" className="space-y-3" aria-labelledby="meals-block-title">
      <SectionHeader id="meals-block-title" icon={Utensils} title={t('meals.heading')} />
      {meals.length === 0 ? (
        <Surface variant="note" className="flex items-center gap-4" data-testid="no-meals">
          <Illustration name="noMeals" size={72} className="text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              {ongoing ? t('meals.emptyToday') : t('meals.empty')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => openComposer({ localDate })}
              data-testid="log-first-meal"
            >
              <Plus aria-hidden="true" />
              {ongoing ? t('day.plan.logFirst') : t('day.plan.logForDate')}
            </Button>
          </div>
        </Surface>
      ) : (
        <div className="space-y-3">
          <Surface variant="list" as="ul" data-testid="recorded-meals">
            {meals.map((meal) => (
              <MealRow key={meal.id} meal={meal} localDate={localDate} zone={zone} />
            ))}
          </Surface>
          {!ongoing ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => openComposer({ localDate })}
              data-testid="log-for-date"
            >
              <Plus aria-hidden="true" />
              {t('day.plan.logForDate')}
            </Button>
          ) : null}
        </div>
      )}
    </section>,
    reflectionAcknowledged ? reflectionBlock : null,
    <CompletenessCheckbox
      key="completeness"
      checked={logComplete}
      onChange={setComplete}
      helper={helper}
      pending={pending}
    />,
  ];

  return <>{blocks}</>;
}

function PlanLink() {
  return (
    <Link
      href="/plan"
      className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
    >
      {t('day.plan.viewPlan')}
      <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
}

/** One recorded meal: time · names · slot, the energy, a camera glyph when photos exist, chevron. */
function MealRow({
  meal,
  localDate,
  zone,
}: {
  meal: MealSummary;
  localDate: string;
  zone: string;
}) {
  const time = meal.consumedLocalTime
    ? formatTime(instantFor(localDate, meal.consumedLocalTime, zone), { timeZone: zone })
    : t('meals.timeUnknown');
  const more = meal.itemCount - meal.itemNames.length;
  return (
    <li>
      <Link
        href={`/meals/${meal.id}`}
        className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        data-testid="meal-row"
      >
        <span className="w-14 shrink-0 text-xs leading-tight tabular-nums text-muted-foreground">
          {time}
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate text-base font-medium">
            <InlineNames names={meal.itemNames} />
            {more > 0 ? (
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                {tp('meals.moreItems', more)}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {meal.slot ? <InlineName name={meal.slot} /> : t('meals.other')}
          </span>
        </span>
        {meal.photoCount > 0 ? (
          <span className="shrink-0 text-muted-foreground">
            <Camera className="size-4" aria-hidden="true" />
            <span className="sr-only">{tp('meals.photos', meal.photoCount)}</span>
          </span>
        ) : null}
        {meal.energyKcal !== null ? (
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {t('meals.kcal', { value: formatNumber(meal.energyKcal) })}
          </span>
        ) : null}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
