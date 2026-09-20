'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { markSlotSkippedAction, setDayCompletenessAction } from '@/actions/day.actions';
import { Button, toast } from '@/components/UiComponents';
import { CompletenessCheckbox } from '@/components/product/CompletenessCheckbox';
import { InlineName, InlineNames } from '@/components/product/InlineName';
import { NutritionDetails } from '@/components/product/NutritionDetails';
import { PlanSlotRow } from '@/components/product/PlanSlotRow';
import { ScoreCard } from '@/components/product/ScoreCard';
import { WhyThisScore } from '@/components/product/WhyThisScore';
import { useComposerOpener } from '@/components/product/composer-bus';
import { formatLocalDate, formatNumber, formatTime } from '@/lib/format';
import type { DayView } from '@/lib/rubric/types';
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
 * The Today blocks (product spec § 9), reused by the History day page with
 * another `localDate`: the reflection (Today only), Your plan today (score,
 * slot rows, nutrition details), Recorded meals, and the completeness
 * checkbox. Data comes from the server page; mutations call actions and the
 * page re-renders. The blocks are a keyed list so "Got it" re-orders the
 * reflection without remounting it.
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
  const [reflectionAcknowledged, setReflectionAcknowledged] = useState(
    reflection?.acknowledged ?? false,
  );

  function skip(planSlotId: string, skipped: boolean) {
    startTransition(async () => {
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
  const unrecorded = view.slots.filter((s) => s.state === 'NOT_RECORDED');
  const nextSlot = unrecorded.find((s) => s.windowState !== 'UPCOMING') ?? unrecorded[0] ?? null;
  const allDone = view.slots.length > 0 && nextSlot === null;
  const { coverage } = view.score;
  const gaps = !ongoing && logComplete && view.mealCount > 0 && coverage.notRecorded > 0;
  const helper = gaps
    ? t('day.completeness.gaps', { recorded: coverage.recorded, total: coverage.prescribed })
    : undefined;

  const reflectionBlock = reflection ? (
    <ReflectionCardIsland
      key="reflection"
      localDate={localDate}
      acknowledged={reflectionAcknowledged}
      onAcknowledged={() => setReflectionAcknowledged(true)}
    />
  ) : null;

  const blocks = [
    reflectionAcknowledged ? null : reflectionBlock,
    <section key="plan" className="space-y-3" aria-labelledby="plan-block-title">
      <h2 id="plan-block-title" className="text-sm font-medium text-muted-foreground">
        {ongoing ? t('day.plan.heading') : t('day.plan.headingPast')}
      </h2>

      {!hasPlan ? (
        <div
          className="space-y-3 rounded-xl border border-border bg-card p-4"
          data-testid="no-plan-card"
        >
          <p className="text-sm">{t('day.plan.noPlan')}</p>
          {!draftPending ? (
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href="/plan/add">{t('day.plan.addPlan')}</Link>
            </Button>
          ) : null}
        </div>
      ) : targetsOnly ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground" data-testid="targets-only">
            {t('day.plan.targetsOnly')}
          </p>
          <NutritionDetails
            nutrition={view.nutrition}
            mealCount={view.mealCount}
            logComplete={logComplete}
            ongoing={ongoing}
          />
          <PlanLink />
        </div>
      ) : (
        <>
          <ScoreCard
            score={view.score}
            ongoing={ongoing}
            dateLabel={formatLocalDate(localDate, { month: 'short', day: 'numeric' })}
          >
            <WhyThisScore view={view} className="mt-3" />
          </ScoreCard>
          <div className="rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border" data-testid="plan-slots">
              {view.slots.map((slot) => (
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
            <div className="space-y-2 border-t border-border p-3">
              {allDone ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => openComposer({ localDate })}
                  data-testid="log-another-meal"
                >
                  {t('day.plan.logAnother')}
                </Button>
              ) : null}
              <NutritionDetails
                nutrition={view.nutrition}
                mealCount={view.mealCount}
                logComplete={logComplete}
                ongoing={ongoing}
              />
              <PlanLink />
            </div>
          </div>
        </>
      )}
    </section>,
    <section key="meals" className="space-y-3" aria-labelledby="meals-block-title">
      <h2 id="meals-block-title" className="text-sm font-medium text-muted-foreground">
        {t('meals.heading')}
      </h2>
      {meals.length === 0 ? (
        <div
          className="space-y-3 rounded-xl border border-border bg-card p-4"
          data-testid="no-meals"
        >
          {!ongoing ? <p className="text-sm text-muted-foreground">{t('meals.empty')}</p> : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => openComposer({ localDate })}
            data-testid="log-first-meal"
          >
            {ongoing ? t('day.plan.logFirst') : t('day.plan.logForDate')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ul
            className="divide-y divide-border rounded-xl border border-border bg-card"
            data-testid="recorded-meals"
          >
            {meals.map((meal) => (
              <MealRow key={meal.id} meal={meal} localDate={localDate} zone={zone} />
            ))}
          </ul>
          {!ongoing ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => openComposer({ localDate })}
              data-testid="log-for-date"
            >
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
      className="flex min-h-11 items-center px-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
    >
      {t('day.plan.viewPlan')}
    </Link>
  );
}

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
        className="flex min-h-11 items-start gap-3 px-3 py-3 hover:bg-accent"
        data-testid="meal-row"
      >
        <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {time}
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-sm">
            <span className="font-medium">
              <InlineNames names={meal.itemNames} />
            </span>
            {more > 0 ? (
              <span className="text-xs text-muted-foreground"> {tp('meals.moreItems', more)}</span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {meal.slot ? <InlineName name={meal.slot} /> : t('meals.other')}
          </span>
        </span>
        {meal.energyKcal !== null ? (
          <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
            {t('meals.kcal', { value: formatNumber(meal.energyKcal) })}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
