import type { RubricSlot, TimingResult } from '@/lib/rubric/types';
import { minutesBetween, timeBand } from '@/lib/time/bands';

/**
 * Consumed time against a stated time or window: descriptive detail with the
 * 60 / 120-minute bands. Unknown time → not evaluated.
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
  let minutes = 0;
  if (minutesBetween(window.start, slotTime) < 0) minutes = minutesBetween(window.start, slotTime);
  else if (minutesBetween(end, slotTime) > 0) minutes = minutesBetween(end, slotTime);
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
    const eatenBefore = minutesBetween(me.time, other.time as string) < 0;
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
