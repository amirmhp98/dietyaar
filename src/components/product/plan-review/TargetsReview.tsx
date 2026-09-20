'use client';

import { useState } from 'react';
import { Flame, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';
import type { DraftSlot, DraftTarget, PlanDraft } from '@/lib/validations/plan';
import { ReviewActions } from './SlotReview';
import { SourceExcerpt } from './SourceExcerpt';
import { AddTargetButton, TargetFields, newTarget, targetComplete } from './TargetFields';
import { nutrientLabel, targetSourceLabel, targetValueText, weekdayName } from './helpers';

export type EstimateState = 'idle' | 'running' | 'failed';

/**
 * Screen 7b: per-meal ranges and daily targets as two-column list surfaces,
 * each row labelled with where its figure comes from (explicit / estimated
 * from the plan / sum of the meal ranges). "Fix" makes the values editable;
 * an edited estimate becomes explicit.
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
      <Surface variant="note" role="status" className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        {t('plan.review.estimating')}
      </Surface>
    ) : estimate === 'failed' ? (
      <Surface variant="note" role="status" className="space-y-2 text-sm">
        <p>{estimateError ?? t('plan.review.estimateFailed')}</p>
        <Button type="button" variant="outline" onClick={onRetryEstimate}>
          {t('plan.review.estimateRetry')}
        </Button>
      </Surface>
    ) : null;

  if (editing) {
    return (
      <div className="space-y-5">
        {status}
        {perMeal.length > 0 ? (
          <section className="space-y-3">
            <SectionHeader icon={Flame} title={t('plan.target.perMeal')} level={3} />
            {perMeal.map((target) => (
              <div key={target.key} className="space-y-2">
                <SlotHeading slot={slotsByKey.get(target.slotKey ?? '')} target={target} />
                <TargetFields target={target} onChange={update} lockNutrient />
              </div>
            ))}
          </section>
        ) : null}
        <section className="space-y-3">
          <SectionHeader icon={Target} title={t('plan.target.daily')} level={3} />
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
            className="w-full"
            loading={saving}
            disabled={!allComplete}
            onClick={() => onSave(targets)}
          >
            {t('plan.review.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
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
        <section className="space-y-3">
          <SectionHeader icon={Flame} title={t('plan.target.perMeal')} level={3} />
          <Surface variant="list" as="ul">
            {perMeal.map((target) => {
              const slot = slotsByKey.get(target.slotKey ?? '');
              return (
                <li
                  key={target.key}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
                >
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
                  <span className="shrink-0 text-sm font-medium tabular-nums" dir="ltr">
                    {targetValueText(target)}
                  </span>
                </li>
              );
            })}
          </Surface>
        </section>
      ) : null}
      <section className="space-y-3">
        <SectionHeader icon={Target} title={t('plan.target.daily')} level={3} />
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('plan.target.none')}</p>
        ) : (
          dailyGroups.map((group) => (
            <div key={String(group.weekday)} className="space-y-2">
              {group.weekday !== null ? (
                <p className="text-sm font-medium">{weekdayName(group.weekday)}</p>
              ) : null}
              <Surface variant="list" as="ul">
                {group.targets.map((target) => (
                  <li key={target.key} className="space-y-2 px-3 py-2">
                    <div className="flex min-h-7 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{nutrientLabel(target.nutrient)}</p>
                        <p className="text-xs text-muted-foreground">
                          {targetSourceLabel(target.source)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums" dir="ltr">
                        {targetValueText(target)}
                      </span>
                    </div>
                    {target.sourceExcerpt ? <SourceExcerpt text={target.sourceExcerpt} /> : null}
                  </li>
                ))}
              </Surface>
            </div>
          ))
        )}
      </section>
      <ReviewActions
        primary={t('plan.review.looksRight')}
        saving={saving}
        disabled={estimate === 'running'}
        onPrimary={() => onLooksRight(targets)}
        onBack={onBack}
        secondary={t('plan.review.fix')}
        onSecondary={() => setEditing(true)}
      />
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
