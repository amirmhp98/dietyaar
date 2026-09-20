/**
 * Meal time windows (product spec § 6 "Optional meal times/windows", § 9):
 * every slot gets one. Times the plan states are kept as they are; every
 * other slot is assumed a window from its name, and names the table does not
 * know split the day evenly between their recognised neighbours. Assumed
 * windows drive the Today actions only; `timing.ts` never scores them.
 */

export interface SlotWindow {
  start: string;
  /** Null only for a stated single time ("at 12:00"). */
  end: string | null;
  assumed: boolean;
}

export type WindowState = 'UPCOMING' | 'OPEN' | 'PASSED';

/** The slot fields the assignment reads and writes (plan rows, rubric slots and draft slots all have them). */
export interface WindowSource {
  weekday: number;
  position: number;
  originalName: string;
  englishLabel: string;
  timeStart: string | null;
  timeEnd: string | null;
  timeAssumed: boolean;
}

interface WindowRule {
  keywords: string[];
  start: string;
  end: string;
}

/** Unrecognised names share this span, in plan order. */
export const DAY_START = '07:00';
export const DAY_END = '22:00';

/**
 * First matching rule wins, so the compound names come before the words they
 * contain ("afternoon snack" before "snack" would otherwise never match; a
 * bare "snack" is deliberately unrecognised and lands between its neighbours).
 * Keywords are matched case-insensitively on the English label, then on the
 * original name for Persian plans.
 */
const RULES: WindowRule[] = [
  {
    keywords: ['before bed', 'bedtime', 'before sleep', 'قبل خواب', 'قبل از خواب'],
    start: '21:00',
    end: '23:30',
  },
  {
    keywords: [
      'pre-workout',
      'pre workout',
      'preworkout',
      'before workout',
      'before training',
      'قبل تمرین',
      'قبل از تمرین',
    ],
    start: '15:00',
    end: '19:00',
  },
  {
    keywords: [
      'post-workout',
      'post workout',
      'postworkout',
      'after workout',
      'after training',
      'بعد تمرین',
      'بعد از تمرین',
    ],
    start: '17:00',
    end: '21:00',
  },
  { keywords: ['breakfast', 'صبحانه'], start: '06:00', end: '10:30' },
  {
    keywords: [
      'morning snack',
      'first snack',
      'mid-morning',
      'snack 1',
      'میان‌وعده اول',
      'میان وعده اول',
      'میان‌وعده صبح',
      'میان وعده صبح',
    ],
    start: '10:00',
    end: '12:30',
  },
  { keywords: ['lunch', 'ناهار'], start: '12:00', end: '15:30' },
  {
    keywords: [
      'afternoon snack',
      'second snack',
      'mid-afternoon',
      'evening snack',
      'snack 2',
      'عصرانه',
      'میان‌وعده دوم',
      'میان وعده دوم',
      'میان‌وعده عصر',
      'میان وعده عصر',
    ],
    start: '15:00',
    end: '18:30',
  },
  { keywords: ['dinner', 'supper', 'شام'], start: '18:30', end: '23:00' },
];

/** Zero-width joiners and Arabic kaf/yeh forms are normalised so "میان‌وعده" matches however it was typed. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The table's window for a slot name, or null when no keyword matches. */
export function keywordWindow(
  slot: Pick<WindowSource, 'originalName' | 'englishLabel'>,
): { start: string; end: string } | null {
  const names = [normalise(slot.englishLabel), normalise(slot.originalName)];
  for (const rule of RULES) {
    const keywords = rule.keywords.map(normalise);
    if (names.some((name) => keywords.some((k) => name.includes(k))))
      return { start: rule.start, end: rule.end };
  }
  return null;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function isStated(slot: WindowSource): boolean {
  return slot.timeStart !== null && !slot.timeAssumed;
}

/**
 * One day's slots in plan order → the same slots with a window each. Stated
 * times stay; keyword matches take the table's window; each run of remaining
 * slots splits the span between the previous recognised slot's end and the
 * next one's start (07:00 and 22:00 at the edges) evenly, and takes the whole
 * 07:00–22:00 when those bounds cross (neighbours that overlap). Windows may
 * overlap; boundaries land on 5 minutes.
 */
function assignDay<T extends WindowSource>(slots: T[]): T[] {
  const resolved: Array<{ start: string; end: string } | null> = slots.map((slot) => {
    if (!isStated(slot)) return keywordWindow(slot);
    const start = slot.timeStart as string;
    return { start, end: slot.timeEnd ?? start };
  });
  const out = slots.map((slot, i) => {
    const window = resolved[i];
    if (isStated(slot) || !window) return slot;
    return { ...slot, timeStart: window.start, timeEnd: window.end, timeAssumed: true };
  });

  let i = 0;
  while (i < slots.length) {
    if (resolved[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < slots.length && !resolved[j]) j += 1;
    const previous = i > 0 ? resolved[i - 1] : null;
    const next = j < slots.length ? resolved[j] : null;
    let lo = toMinutes(previous?.end ?? DAY_START);
    let hi = toMinutes(next?.start ?? DAY_END);
    if (hi <= lo) {
      lo = toMinutes(DAY_START);
      hi = toMinutes(DAY_END);
    }
    const count = j - i;
    const length = (hi - lo) / count;
    for (let k = 0; k < count; k += 1) {
      out[i + k] = {
        ...slots[i + k],
        timeStart: toTime(lo + k * length),
        timeEnd: toTime(lo + (k + 1) * length),
        timeAssumed: true,
      };
    }
    i = j;
  }
  return out;
}

/**
 * Every slot of a plan, any order → the same slots, same order, each with a
 * window. Weekday plans are assigned one day at a time in position order.
 * Deterministic and idempotent: an assumed window is recomputed from the
 * current names, a stated one is left alone.
 */
export function assignWindows<T extends WindowSource>(slots: T[]): T[] {
  const byWeekday = new Map<number, T[]>();
  for (const slot of slots)
    byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot]);
  const assigned = new Map<T, T>();
  for (const day of byWeekday.values()) {
    const ordered = [...day].sort((a, b) => a.position - b.position);
    for (const [index, slot] of assignDay(ordered).entries()) assigned.set(ordered[index], slot);
  }
  return slots.map((slot) => assigned.get(slot) ?? slot);
}

/** The slot's window for display, or null for a slot that never got one. */
export function windowOf(
  slot: Pick<WindowSource, 'timeStart' | 'timeEnd' | 'timeAssumed'>,
): SlotWindow | null {
  return slot.timeStart === null
    ? null
    : { start: slot.timeStart, end: slot.timeEnd, assumed: slot.timeAssumed };
}

/** A stated single time is open for the rubric's small band (product spec § 8). */
const SINGLE_TIME_OPEN_MINUTES = 60;

/**
 * Where the clock stands against a window on the day itself: before its
 * start, inside it (both ends inclusive), or after its end. A window that
 * crosses midnight stays open until the day ends.
 */
export function windowStateAt(window: SlotWindow, nowLocalTime: string): WindowState {
  const now = toMinutes(nowLocalTime);
  const start = toMinutes(window.start);
  if (now < start) return 'UPCOMING';
  const end = window.end === null ? start + SINGLE_TIME_OPEN_MINUTES : toMinutes(window.end);
  if (end < start) return 'OPEN';
  return now > end ? 'PASSED' : 'OPEN';
}
