'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { t } from '@/lib/t';
import type { DraftSlot, DraftTarget, PlanDraft } from '@/lib/validations/plan';
import { SourceExcerpt } from './SourceExcerpt';
import { AddTargetButton, TargetFields, newTarget, targetComplete } from './TargetFields';
import { nutrientLabel, targetSourceLabel, targetValueText, weekdayName } from './helpers';

export type EstimateState = 'idle' | 'running' | 'failed';

/**
 * Screen 7b: per-meal ranges and daily targets, each labelled with where it
 * comes from (explicit / estimated from the plan / sum of the meal ranges).
 * "Fix" makes the values editable; an edited estimate becomes explicit.
 */
export function TargetsReview({
  draft,
  estimate,
  estimateError,
  saving,
  onRetryEstimate,
  onLooksRight,
  onSave,
  onBack,
}: {
  draft: Pick<PlanDraft, 'slots' | 'targets' | 'structure'>;
  estimate: EstimateState;
  estimateError: string | null;
  saving: boolean;
  onRetryEstimate: () => void;
  /** Accept the targets as shown and move on. */
  onLooksRight: (targets: DraftTarget[]) => void;
  /** "Fix" → Save changes: persist the edited targets and stay on this screen. */
  onSave: (targets: DraftTarget[]) => void;
  onBack?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [targets, setTargets] = useState(draft.targets);
  const slotsByKey = new Map(draft.slots.map((s) => [s.key, s]));
  const perMeal = targets.filter((x) => x.slotKey !== null);
  const daily = targets.filter((x) => x.slotKey === null);
  const dailyGroups = groupByWeekday(daily);
  const allComplete = targets.every(targetComplete);

  function update(next: DraftTarget) {
    setTargets((list) => list.map((x) => (x.key === next.key ? next : x)));
  }
  function remove(key: string) {
    setTargets((list) => list.filter((x) => x.key !== key));
  }

  const status =
    estimate === 'running' ? (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('plan.review.estimating')}
      </p>
    ) : estimate === 'failed' ? (
      <div role="status" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <p>{estimateError ?? t('plan.review.estimateFailed')}</p>
        <Button type="button" variant="outline" className="h-11" onClick={onRetryEstimate}>
          {t('plan.review.estimateRetry')}
        </Button>
      </div>
    ) : null;

  if (editing) {
    return (
      <div className="space-y-5">
        {status}
        {perMeal.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('plan.target.perMeal')}
            </h2>
            {perMeal.map((target) => (
              <div key={target.key} className="space-y-2">
                <SlotHeading slot={slotsByKey.get(target.slotKey ?? '')} target={target} />
                <TargetFields target={target} onChange={update} lockNutrient />
              </div>
            ))}
          </section>
        ) : null}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t('plan.target.daily')}</h2>
          {dailyGroups.map((group) => (
            <div key={String(group.weekday)} className="space-y-3">
              {group.weekday !== null ? (
                <p className="text-sm font-medium">{weekdayName(group.weekday)}</p>
              ) : null}
              {group.targets.map((target) => (
                <TargetFields
                  key={target.key}
                  target={target}
                  onChange={update}
                  onRemove={() => remove(target.key)}
                />
              ))}
            </div>
          ))}
          <AddTargetButton onAdd={() => setTargets((list) => [...list, newTarget()])} />
        </section>
        <div className="grid gap-3">
          <Button
            type="button"
            className="h-11 w-full"
            loading={saving}
            disabled={!allComplete}
            onClick={() => onSave(targets)}
          >
            {t('plan.review.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            disabled={saving}
            onClick={() => {
              setTargets(draft.targets);
              setEditing(false);
            }}
          >
            {t('plan.review.cancelEdit')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('plan.review.targetsIntro')}</p>
      {status}
      {perMeal.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t('plan.target.perMeal')}</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {perMeal.map((target) => {
              const slot = slotsByKey.get(target.slotKey ?? '');
              return (
                <li key={target.key} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    {slot ? (
                      <NameLabel
                        originalName={slot.originalName}
                        englishLabel={slot.englishLabel}
                        size="sm"
                      />
                    ) : (
                      <span className="text-sm">{nutrientLabel(target.nutrient)}</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {targetSourceLabel(target.source)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm" dir="ltr">
                    {targetValueText(target)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t('plan.target.daily')}</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('plan.target.none')}</p>
        ) : (
          dailyGroups.map((group) => (
            <div key={String(group.weekday)} className="space-y-2">
              {group.weekday !== null ? (
                <p className="text-sm font-medium">{weekdayName(group.weekday)}</p>
              ) : null}
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {group.targets.map((target) => (
                  <li key={target.key} className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{nutrientLabel(target.nutrient)}</span>
                      <span className="shrink-0 text-sm" dir="ltr">
                        {targetValueText(target)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {targetSourceLabel(target.source)}
                    </p>
                    {target.sourceExcerpt ? <SourceExcerpt text={target.sourceExcerpt} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <div className="grid gap-3">
        <Button
          type="button"
          className="h-11 w-full"
          loading={saving}
          disabled={estimate === 'running'}
          onClick={() => onLooksRight(targets)}
        >
          {t('plan.review.looksRight')}
        </Button>
        <div className={onBack ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={saving}
              onClick={onBack}
            >
              {t('plan.review.back')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={saving || estimate === 'running'}
            onClick={() => setEditing(true)}
          >
            {t('plan.review.fix')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SlotHeading({ slot, target }: { slot: DraftSlot | undefined; target: DraftTarget }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {slot ? (
        <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} size="sm" />
      ) : (
        <span className="text-sm">{nutrientLabel(target.nutrient)}</span>
      )}
      <span className="text-xs text-muted-foreground">{targetSourceLabel(target.source)}</span>
    </div>
  );
}

function groupByWeekday(targets: DraftTarget[]) {
  const groups = new Map<number | null, DraftTarget[]>();
  for (const target of targets) {
    const key = target.weekday === null || target.weekday === 7 ? null : target.weekday;
    groups.set(key, [...(groups.get(key) ?? []), target]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] ?? -1) - (b[0] ?? -1))
    .map(([weekday, list]) => ({ weekday, targets: list }));
}
