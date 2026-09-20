import type { RubricSlot, TimingResult } from '@/lib/rubric/types';
import { circularMinutesBetween, timeBand } from '@/lib/time/bands';

/**
 * The window the timing rubric may compare with: only times the plan states.
 * An assumed window (product spec § 6) leaves the order rule in force, so a
 * plan without clock times is never scored on invented ones.
 */
export function statedWindow(
  slot: Pick<RubricSlot, 'timeStart' | 'timeEnd' | 'timeAssumed'>,
): { start: string; end: string | null } | null {
  return slot.timeStart && !slot.timeAssumed ? { start: slot.timeStart, end: slot.timeEnd } : null;
}

/**
 * Consumed time against a stated time or window: descriptive detail with the
 * 60 / 120-minute bands, measured around the clock so a late supper at 00:30
 * counts as after a 21:00 slot. Unknown time → not evaluated.
 */
export function timeResult(
  slotTime: string | null,
  window: { start: string; end: string | null },
): TimingResult {
  if (slotTime === null) {
    return {
      kind: 'TIME',
      band: null,
      minutes: null,
      outOfOrderWith: null,
      notEvaluatedReason: 'TIME_UNKNOWN',
    };
  }
  const end = window.end ?? window.start;
  const fromStart = circularMinutesBetween(window.start, slotTime);
  const fromEnd = circularMinutesBetween(end, slotTime);
  const minutes = fromStart < 0 ? fromStart : fromEnd > 0 ? fromEnd : 0;
  return {
    kind: 'TIME',
    band: timeBand(minutes),
    minutes,
    outOfOrderWith: null,
    notEvaluatedReason: null,
  };
}

export interface OrderEntry {
  slot: RubricSlot;
  time: string | null;
}

/**
 * Order rule when the plan has no times: compare the consumed order of the
 * day's recorded prescribed slots with the plan's slot order. A single
 * recorded slot has no reference. Out of order is NOTICEABLE; there is no
 * LARGE band.
 */
export function orderResult(slot: RubricSlot, recorded: OrderEntry[]): TimingResult {
  const me = recorded.find((r) => r.slot.id === slot.id);
  if (!me || me.time === null) {
    return {
      kind: 'ORDER',
      band: null,
      minutes: null,
      outOfOrderWith: null,
      notEvaluatedReason: 'TIME_UNKNOWN',
    };
  }
  const others = recorded.filter((r) => r.slot.id !== slot.id && r.time !== null);
  if (others.length === 0) {
    return {
      kind: 'ORDER',
      band: null,
      minutes: null,
      outOfOrderWith: null,
      notEvaluatedReason: 'NO_ORDER_REFERENCE',
    };
  }
  for (const other of others) {
    const plannedBefore = other.slot.position < slot.position;
    const eatenBefore = circularMinutesBetween(me.time, other.time as string) < 0;
    if (plannedBefore !== eatenBefore) {
      return {
        kind: 'ORDER',
        band: 'NOTICEABLE',
        minutes: null,
        outOfOrderWith: {
          slot: { originalName: other.slot.originalName, englishLabel: other.slot.englishLabel },
          direction: plannedBefore ? 'BEFORE' : 'AFTER',
        },
        notEvaluatedReason: null,
      };
    }
  }
  return {
    kind: 'ORDER',
    band: 'SMALL',
    minutes: null,
    outOfOrderWith: null,
    notEvaluatedReason: null,
  };
}
