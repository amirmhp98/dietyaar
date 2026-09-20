'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { DifferenceChip, type DifferenceKind } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { IconAction } from '@/components/product/IconAction';
import { fillNames, InlineName, InlineNames } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';
import { slotWindowText } from '@/components/product/SlotWindow';
import { StatusGlyph, type StatusGlyphName } from '@/components/product/StatusGlyph';
import { formatNumber } from '@/lib/format';
import { optionNumber } from '@/lib/rubric/options';
import type { EnergyResult, RubricTarget, SlotView } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { portionAmount } from '@/lib/units';
import { cn } from '@/lib/utils';

/**
 * Plan slot row (design-scope "Shared components", product spec § 9, design.md
 * "Product UI"): a leading status glyph whose shape is the state, the name as
 * written, one status line, the window · options · energy subline, and the
 * actions the window allows as icon buttons: an open or passed slot can be
 * logged (outline ＋) or skipped (ghost —), an upcoming one only logged early
 * through a faint ＋, a skipped one restored. The next slot to log carries the
 * full-width outline "Log this meal"; a recorded row is one tap target that
 * expands into its difference chips. The floating Log meal button stays the
 * only filled emerald on the screen.
 */
export function PlanSlotRow({
  slot,
  highlighted = false,
  pending = false,
  onLog,
  onSkip,
  reviewHref,
  ongoing = true,
}: {
  slot: SlotView;
  /** The next slot to log (the first open or passed unrecorded one) carries "Log this meal". */
  highlighted?: boolean;
  pending?: boolean;
  onLog?: () => void;
  onSkip?: (skipped: boolean) => void;
  /** Meal details of the first linked meal (Needs review → choose the option there). */
  reviewHref?: string;
  /** False on a past day: every window has passed, so the "window passed" nudge stays quiet. */
  ongoing?: boolean;
}) {
  const { state, match, windowState } = slot;
  const name = slot.slot.originalName;
  const glyph = glyphFor(slot);
  const subline = [
    slotWindowText(slot.window),
    optionLine(slot),
    energyRangeLine(slot.energyTarget),
  ].filter((part): part is string => part !== null);
  const passed = state === 'NOT_RECORDED' && windowState === 'PASSED' && ongoing;

  const head = (
    <Fragment>
      <NameLabel originalName={name} englishLabel={slot.slot.englishLabel} />
      <span className="block text-sm text-muted-foreground" data-testid="slot-status">
        {state === 'RECORDED'
          ? (statusLabel(slot) ?? t('glyph.status.recorded'))
          : state === 'SKIPPED'
            ? t('slot.state.skipped')
            : state === 'NEEDS_REVIEW'
              ? t('slot.state.needsReview')
              : t('slot.state.notRecorded')}
      </span>
      {/* Wraps rather than truncates: beside two 44 px actions the energy range would be cut. */}
      <span className="block text-xs text-muted-foreground">
        {subline.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? ' · ' : null}
            {part}
          </Fragment>
        ))}
      </span>
      {passed ? (
        <span className="block text-xs text-muted-foreground" data-testid="window-passed">
          {t('slot.window.passed')}
        </span>
      ) : null}
    </Fragment>
  );

  return (
    <li
      data-testid="plan-slot-row"
      data-slot-state={state}
      data-window-state={windowState}
      className={cn(highlighted && 'bg-tint-1')}
    >
      {state === 'RECORDED' && match ? (
        // The whole row opens the differences: one 44 px target with the chevron at the end.
        <Disclosure
          testId="slot-details"
          triggerClassName="items-start rounded-none px-3 py-3 font-normal focus-visible:ring-inset focus-visible:ring-offset-0"
          contentClassName="ps-11 pe-3 pb-3 pt-0"
          label={
            <span className="flex items-start gap-3">
              <StatusGlyph status={glyph} describe={false} className="mt-0.5" />
              <span className="min-w-0 flex-1 space-y-0.5">{head}</span>
            </span>
          }
        >
          <SlotDetails slot={slot} />
        </Disclosure>
      ) : (
        <div className="px-3 py-3">
          <div className="flex items-start gap-3">
            {/* The clock adds what the visible text does not say: the window has not opened. */}
            <StatusGlyph status={glyph} describe={glyph === 'UPCOMING'} className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-0.5">{head}</div>
            <div className="-me-2 -mt-1.5 flex shrink-0 items-center">
              {state === 'NOT_RECORDED' && !highlighted && windowState === 'UPCOMING' && onLog ? (
                <IconAction
                  label={t('slot.logEarly', { slot: name })}
                  icon={Plus}
                  className="text-muted-foreground/70"
                  onClick={onLog}
                  disabled={pending}
                  data-testid="log-slot-early"
                />
              ) : null}
              {state === 'NOT_RECORDED' && !highlighted && windowState !== 'UPCOMING' ? (
                <Fragment>
                  {onLog ? (
                    <IconAction
                      label={t('slot.logAria', { slot: name })}
                      icon={Plus}
                      variant="outline"
                      onClick={onLog}
                      disabled={pending}
                      data-testid="log-slot"
                    />
                  ) : null}
                  {onSkip ? (
                    <IconAction
                      label={t('slot.skipAria', { slot: name })}
                      icon={Minus}
                      className="text-muted-foreground"
                      onClick={() => onSkip(true)}
                      disabled={pending}
                      data-testid="mark-skipped"
                    />
                  ) : null}
                </Fragment>
              ) : null}
              {state === 'SKIPPED' && onSkip ? (
                <IconAction
                  label={t('slot.unskip')}
                  icon={RotateCcw}
                  className="text-muted-foreground"
                  onClick={() => onSkip(false)}
                  disabled={pending}
                  data-testid="unskip"
                />
              ) : null}
            </div>
          </div>

          {state === 'NEEDS_REVIEW' && reviewHref ? (
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href={reviewHref}>{t('slot.state.chooseOption')}</Link>
            </Button>
          ) : null}

          {/* Outline, not filled: the Log meal button stays the one filled emerald on the screen (decision 025). */}
          {state === 'NOT_RECORDED' && highlighted ? (
            <div className="mt-3 flex items-center gap-2">
              {onLog ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onLog}
                  disabled={pending}
                  data-testid="log-this-meal"
                >
                  <Plus aria-hidden="true" />
                  {t('day.plan.logThis')}
                </Button>
              ) : null}
              {onSkip ? (
                <IconAction
                  label={t('slot.skipAria', { slot: name })}
                  icon={Minus}
                  className="shrink-0 text-muted-foreground"
                  onClick={() => onSkip(true)}
                  disabled={pending}
                  data-testid="mark-skipped"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

// ─── Glyph and labels ──────────────────────────────────────────────────────

/** The row's glyph: the record state, or the match result once recorded. */
export function glyphFor(slot: SlotView): StatusGlyphName {
  switch (slot.state) {
    case 'SKIPPED':
      return 'SKIPPED';
    case 'NEEDS_REVIEW':
      return 'NEEDS_REVIEW';
    case 'RECORDED':
      return slot.match?.status === 'DIFFERENT_FOOD'
        ? 'DIFFERENT'
        : slot.match?.status === 'PARTLY_MATCHED'
          ? 'PARTLY'
          : 'RECORDED';
    case 'NOT_RECORDED':
      return slot.windowState === 'UPCOMING' ? 'UPCOMING' : 'NOT_RECORDED';
  }
}

/** The picked option by its place in the plan ("Option 2"), or the count still to choose from. */
function optionLine(slot: SlotView): string | null {
  if (slot.state === 'RECORDED' || slot.state === 'NEEDS_REVIEW') {
    // A meal saved under the slot without an option (a different food) names none.
    const n = optionNumber(slot.slot, slot.option?.id);
    return n === null || slot.slot.options.length <= 1 ? null : t('plan.option.n', { n });
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

/** "120 g", "3 slices"; a piece count is a bare number since the item's name leads the chip. */
function amount(value: number, unit: string): string {
  return portionAmount(value, unit);
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
