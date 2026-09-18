'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/UiComponents';
import { DifferenceChip, type DifferenceKind } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { fillNames, InlineName, InlineNames } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';
import { formatNumber } from '@/lib/format';
import type { EnergyResult, RubricTarget, SlotView } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { unitByKey } from '@/lib/units';
import { cn } from '@/lib/utils';

/**
 * Plan slot row (design-scope "Shared components", product spec § 9): one row
 * per prescribed slot with the name, one status label, the option count or
 * picked option, the energy range, and the row's one action. A recorded row
 * expands into its differences; everything else stays compact.
 */
export function PlanSlotRow({
  slot,
  highlighted = false,
  pending = false,
  onLog,
  onSkip,
  reviewHref,
}: {
  slot: SlotView;
  /** The next unrecorded slot in plan order carries "Log this meal". */
  highlighted?: boolean;
  pending?: boolean;
  onLog?: () => void;
  onSkip?: (skipped: boolean) => void;
  /** Meal details of the first linked meal (Needs review → choose the option there). */
  reviewHref?: string;
}) {
  const { state, match } = slot;
  const subline = [optionLine(slot), energyRangeLine(slot.energyTarget)].filter(
    (part): part is ReactNode => part !== null,
  );

  return (
    <li
      data-testid="plan-slot-row"
      data-slot-state={state}
      className={cn(
        'space-y-2 px-3 py-3',
        highlighted && 'rounded-lg bg-accent/60 ring-1 ring-border',
      )}
    >
      <div className="flex min-h-11 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <NameLabel
            originalName={slot.slot.originalName}
            englishLabel={slot.slot.englishLabel}
            inline
          />
          {subline.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subline.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 ? ' · ' : null}
                  {part}
                </Fragment>
              ))}
            </p>
          ) : null}
        </div>
        {state !== 'RECORDED' ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="pt-0.5 text-sm text-muted-foreground" data-testid="slot-status">
              {state === 'SKIPPED'
                ? t('slot.state.skipped')
                : state === 'NEEDS_REVIEW'
                  ? t('slot.state.needsReview')
                  : t('slot.state.notRecorded')}
            </span>
            {/* Compact rows keep their one secondary action beside the status; the highlighted row gets a full action line. */}
            {state === 'NOT_RECORDED' && !highlighted && onSkip ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-me-2 h-9 px-2 text-muted-foreground"
                onClick={() => onSkip(true)}
                disabled={pending}
                data-testid="mark-skipped"
              >
                {t('slot.markSkipped')}
              </Button>
            ) : null}
            {state === 'SKIPPED' && onSkip ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-me-2 h-9 px-2 text-muted-foreground"
                onClick={() => onSkip(false)}
                disabled={pending}
                data-testid="unskip"
              >
                {t('slot.unskip')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {state === 'RECORDED' && match ? (
        <Disclosure
          testId="slot-details"
          triggerClassName="font-normal"
          label={
            <span data-testid="slot-status" className="text-sm">
              {statusLabel(slot)}
            </span>
          }
        >
          <SlotDetails slot={slot} />
        </Disclosure>
      ) : null}

      {state === 'NEEDS_REVIEW' && reviewHref ? (
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href={reviewHref}>{t('slot.state.chooseOption')}</Link>
        </Button>
      ) : null}

      {state === 'NOT_RECORDED' && highlighted ? (
        <div className="flex items-center gap-2">
          {onLog ? (
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={onLog}
              disabled={pending}
              data-testid="log-this-meal"
            >
              {t('day.plan.logThis')}
            </Button>
          ) : null}
          {onSkip ? (
            <Button
              type="button"
              variant="ghost"
              className={cn('h-11', highlighted ? 'shrink-0' : 'ms-auto')}
              onClick={() => onSkip(true)}
              disabled={pending}
              data-testid="mark-skipped"
            >
              {t('slot.markSkipped')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ─── Labels ────────────────────────────────────────────────────────────────

/** The picked option's label is user text: isolated so digits and dots around it never flip. */
function optionLine(slot: SlotView): ReactNode | null {
  if (slot.state === 'RECORDED' || slot.state === 'NEEDS_REVIEW') {
    return slot.option?.label
      ? fillNames(t('slot.option.picked', { label: '{label}' }), {
          label: <bdi>{slot.option.label}</bdi>,
        })
      : null;
  }
  const count = slot.slot.options.length;
  return count > 1 ? t('slot.options', { count }) : null;
}

function energyRangeLine(target: RubricTarget | null): string | null {
  if (!target) return null;
  const { type, low, high } = target;
  if (type === 'RANGE' && low !== null && high !== null)
    return t('slot.energy.range', { low: formatNumber(low), high: formatNumber(high) });
  if (type === 'MINIMUM' && low !== null) return t('slot.energy.min', { value: formatNumber(low) });
  if (type === 'MAXIMUM') {
    const limit = high ?? low;
    return limit === null ? null : t('slot.energy.max', { value: formatNumber(limit) });
  }
  return low === null ? null : t('slot.energy.about', { value: formatNumber(low) });
}

/** The one status label of a recorded row: the match result plus its reason. */
function statusLabel(slot: SlotView): ReactNode {
  const match = slot.match;
  if (!match) return null;
  if (match.status === 'MATCHED') return t('slot.match.matched');
  if (match.status === 'DIFFERENT_FOOD') return t('slot.match.different');
  return (
    <>
      {t('slot.match.partly')}
      {match.reason ? <> · {reasonText(slot)}</> : null}
    </>
  );
}

function reasonText(slot: SlotView): ReactNode {
  const match = slot.match;
  if (!match?.reason) return null;
  switch (match.reason) {
    case 'MISSING':
      return fillNames(t('slot.reason.missing', { names: '{names}' }), {
        names: <InlineNames names={match.missing} />,
      });
    case 'MIXED':
      return t('slot.reason.mixed');
    case 'CROSS_SLOT':
      return match.crossSlot
        ? fillNames(t('slot.reason.crossSlot', { slot: '{slot}' }), {
            slot: <InlineName name={match.crossSlot} />,
          })
        : null;
    case 'ADDED':
      return fillNames(t('slot.reason.added', { names: '{names}' }), {
        names: <InlineNames names={match.added} />,
      });
  }
}

// ─── Expanded details ──────────────────────────────────────────────────────

function amount(value: number, unit: string): string {
  return `${formatNumber(value)} ${unitByKey(unit)?.label ?? unit}`;
}

function SlotDetails({ slot }: { slot: SlotView }) {
  const chips: Array<{ kind: DifferenceKind; node: ReactNode; key: string }> = [];
  const lines: Array<{ node: ReactNode; key: string }> = [];
  const { portion, timing, slotEnergy } = slot;

  // The match reason already sits in the row's status label; chips cover the other dimensions.
  for (const item of portion?.items ?? []) {
    if (item.band === 'SMALL') continue;
    const more = item.ratio > 0;
    const params = {
      actual: amount(item.actual, item.unit),
      planned: amount(item.planned, item.unit),
    };
    const text =
      item.band === 'NOTICEABLE'
        ? more
          ? t('slot.portion.bitMore', params)
          : t('slot.portion.bitLess', params)
        : more
          ? t('slot.portion.more', params)
          : t('slot.portion.less', params);
    chips.push({
      kind: more ? 'PORTION_MORE' : 'PORTION_LESS',
      key: `portion-${item.planItem.id}`,
      node: (
        <>
          <InlineName name={item.planItem} />: {text}
        </>
      ),
    });
  }
  if (portion && portion.items.length > 0 && portion.items.every((i) => i.band === 'SMALL')) {
    lines.push({ key: 'portion-ok', node: t('slot.portion.asPlanned') });
  }
  if (portion && portion.notEvaluated.length > 0) {
    lines.push({
      key: 'portion-ne',
      node: fillNames(t('slot.portion.notEvaluated', { names: '{names}' }), {
        names: <InlineNames names={portion.notEvaluated} />,
      }),
    });
  }

  if (timing) {
    if (timing.kind === 'ORDER') {
      lines.push({ key: 'by-order', node: t('slot.timing.byOrder') });
      if (timing.notEvaluatedReason === 'TIME_UNKNOWN')
        lines.push({ key: 'time-ne', node: t('slot.timing.notEvaluated') });
      else if (timing.notEvaluatedReason === 'NO_ORDER_REFERENCE')
        lines.push({ key: 'no-ref', node: t('slot.timing.noReference') });
      else if (timing.outOfOrderWith) {
        const key =
          timing.outOfOrderWith.direction === 'BEFORE' ? 'slot.timing.before' : 'slot.timing.after';
        chips.push({
          kind: 'ORDER',
          key: 'order',
          node: fillNames(t(key, { slot: '{slot}' }), {
            slot: <InlineName name={timing.outOfOrderWith.slot} />,
          }),
        });
      } else lines.push({ key: 'in-order', node: t('slot.timing.inOrder') });
    } else if (timing.kind === 'TIME') {
      if (timing.band === null || timing.minutes === null)
        lines.push({ key: 'time-ne', node: t('slot.timing.notEvaluated') });
      else if (timing.minutes === 0) lines.push({ key: 'within', node: t('slot.timing.within') });
      else {
        const minutes = Math.abs(timing.minutes);
        const after = timing.minutes > 0;
        if (timing.band === 'SMALL')
          lines.push({
            key: 'time-small',
            node: after
              ? t('slot.timing.minAfter', { minutes })
              : t('slot.timing.minBefore', { minutes }),
          });
        else
          chips.push({
            kind: 'TIME',
            key: 'time',
            node: after
              ? t('slot.timing.later', { minutes })
              : t('slot.timing.earlier', { minutes }),
          });
      }
    }
  }

  const energyLine = slotEnergyLine(slotEnergy);
  if (energyLine) lines.push({ key: 'energy', node: energyLine });
  if (slot.recordedEnergyKcal !== null)
    lines.push({
      key: 'kcal',
      node: t('slot.energy.recorded', { value: formatNumber(Math.round(slot.recordedEnergyKcal)) }),
    });

  return (
    <div className="space-y-2 text-sm">
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <DifferenceChip key={chip.key} kind={chip.kind}>
              {chip.node}
            </DifferenceChip>
          ))}
        </div>
      ) : null}
      {lines.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {lines.map((line) => (
            <li key={line.key}>{line.node}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function slotEnergyLine(energy: EnergyResult | null): string | null {
  if (!energy) return null;
  if (energy.status === 'WITHIN') return t('slot.energy.within');
  const above = energy.status === 'ABOVE';
  if (energy.band === 'NOTICEABLE')
    return above ? t('slot.energy.slightlyAbove') : t('slot.energy.slightlyBelow');
  const value = formatNumber(Math.abs(Math.round(energy.difference)));
  return above ? t('slot.energy.above', { value }) : t('slot.energy.below', { value });
}
