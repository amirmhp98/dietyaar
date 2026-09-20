import type { DayView, FoodName, RubricSlot, SlotView } from '@/lib/rubric/types';
import { portionAmount } from '@/lib/units';

/**
 * The structured facts the reflection prompt receives (product spec § 11).
 * Each fact carries a `signature`: the band or status that, when it changes
 * after generation, makes a paragraph that used the fact stale. Text is
 * English; food and slot names are quoted as written with the English label.
 */
export interface ReflectionFact {
  id: string;
  kind:
    | 'COMPLETENESS'
    | 'COVERAGE'
    | 'SCORE'
    | 'SLOT'
    | 'PORTION'
    | 'TIMING'
    | 'ENERGY'
    | 'TODAY_PLAN'
    | 'TODAY_NEXT'
    | 'TODAY_RECORDED'
    | 'CONTEXT';
  text: string;
  signature: string;
}

export interface ReflectionContext {
  greetingName: string;
  /** 'MORNING' | 'AFTERNOON' | 'EVENING' from `now` in the user's zone. */
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  hasPlan: boolean;
  /** No confirmed meal on any day before today. */
  isFirstDay: boolean;
  profile?: {
    ageYears: number | null;
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
  };
}

export const quoted = (f: FoodName) =>
  f.originalName.trim() && f.originalName.trim() !== f.englishLabel.trim()
    ? `${f.originalName} (${f.englishLabel})`
    : f.englishLabel;

function slotFacts(view: SlotView): ReflectionFact[] {
  const facts: ReflectionFact[] = [];
  const slotId = `slot:${view.slot.id}`;
  const name = quoted(view.slot);
  switch (view.state) {
    case 'NOT_RECORDED':
      facts.push({
        id: slotId,
        kind: 'SLOT',
        text: `No matching meal was recorded for ${name}.`,
        signature: 'NOT_RECORDED',
      });
      break;
    case 'SKIPPED':
      facts.push({
        id: slotId,
        kind: 'SLOT',
        text: `${name} was marked skipped.`,
        signature: 'SKIPPED',
      });
      break;
    case 'NEEDS_REVIEW':
      facts.push({
        id: slotId,
        kind: 'SLOT',
        text: `${name} was recorded but its option still needs to be chosen.`,
        signature: 'NEEDS_REVIEW',
      });
      break;
    case 'RECORDED': {
      const m = view.match;
      if (!m) break;
      let text = '';
      if (m.status === 'MATCHED') text = `${name} matched the plan.`;
      else if (m.status === 'PARTLY_MATCHED') {
        const why =
          m.reason === 'ADDED'
            ? `an item was added: ${m.added.map(quoted).join(', ')}`
            : m.reason === 'MIXED'
              ? 'items came from two options'
              : m.reason === 'CROSS_SLOT' && m.crossSlot
                ? `it was a ${quoted(m.crossSlot)} option`
                : `missing: ${m.missing.map(quoted).join(', ')}`;
        text = `${name} partly matched the plan (${why}).`;
      } else text = `A different food was recorded for ${name}.`;
      facts.push({ id: slotId, kind: 'SLOT', text, signature: `${m.status}:${m.reason ?? ''}` });
      for (const p of view.portion?.items ?? []) {
        if (p.band === 'SMALL') continue;
        const dir = p.ratio > 0 ? 'more' : 'less';
        facts.push({
          id: `portion:${view.slot.id}:${p.planItem.id}`,
          kind: 'PORTION',
          text: `${quoted(p.planItem)} in ${name} was ${p.band === 'LARGE' ? 'notably ' : 'a bit '}${dir} than planned (${portionAmount(p.actual, p.unit)} instead of ${portionAmount(p.planned, p.unit)}).`,
          signature: `${p.band}:${dir}`,
        });
      }
      const t = view.timing;
      if (t?.band && t.band !== 'SMALL') {
        const text =
          t.kind === 'ORDER' && t.outOfOrderWith
            ? `${name} was eaten ${t.outOfOrderWith.direction === 'BEFORE' ? 'before' : 'after'} ${quoted(t.outOfOrderWith.slot)}, out of the plan's order.`
            : `${name} was ${t.minutes && t.minutes < 0 ? 'earlier' : 'later'} than the planned time by ${Math.abs(t.minutes ?? 0)} minutes.`;
        facts.push({ id: `timing:${view.slot.id}`, kind: 'TIMING', text, signature: `${t.band}` });
      }
      break;
    }
  }
  return facts;
}

/** Facts about yesterday (the retrospective) plus today's plan context. */
export function reflectionFacts(
  yesterday: DayView | null,
  todaySlots: RubricSlot[],
  today: DayView | null,
  context: ReflectionContext,
): ReflectionFact[] {
  const facts: ReflectionFact[] = [];
  facts.push({
    id: 'ctx:name',
    kind: 'CONTEXT',
    text: `The user's name is ${context.greetingName}.`,
    signature: context.greetingName,
  });
  facts.push({
    id: 'ctx:time',
    kind: 'CONTEXT',
    text: `It is ${context.timeOfDay.toLowerCase()} for the user.`,
    signature: context.timeOfDay,
  });

  if (yesterday && yesterday.mealCount > 0) {
    const c = yesterday.score.coverage;
    facts.push({
      id: 'completeness',
      kind: 'COMPLETENESS',
      text: yesterday.logComplete
        ? "Yesterday's log is checked as complete (this is an assumption, not a confirmation)."
        : "Yesterday's log is marked incomplete; only the recorded meals are known.",
      signature: `${yesterday.logComplete}`,
    });
    facts.push({
      id: 'coverage',
      kind: 'COVERAGE',
      text: `${c.recorded} of ${c.prescribed} prescribed meals were recorded yesterday${c.skipped ? `, ${c.skipped} marked skipped` : ''}${yesterday.score.completeByDefault ? ' (some slots have no record)' : ''}.`,
      signature: `${c.recorded}/${c.prescribed}/${c.skipped}/${yesterday.score.completeByDefault}`,
    });
    if (yesterday.score.band !== 'NOT_ENOUGH') {
      const label =
        yesterday.score.band === 'CLOSELY'
          ? 'closely followed'
          : yesterday.score.band === 'MOSTLY'
            ? 'mostly followed'
            : 'different from the plan';
      facts.push({
        id: 'score',
        kind: 'SCORE',
        text: `Overall, yesterday's recorded meals ${label} the plan.`,
        signature: yesterday.score.band,
      });
    }
    for (const s of yesterday.slots) facts.push(...slotFacts(s));
    // A day checked with slots left unrecorded is "complete by default": its total
    // is a partial sum, so "950 kcal short" would reprimand an unfinished log
    // (product spec § 8). The coverage fact above already says what is missing.
    if (
      yesterday.dailyEnergy &&
      yesterday.logComplete &&
      yesterday.dayPhase === 'PAST' &&
      !yesterday.score.completeByDefault
    ) {
      const e = yesterday.dailyEnergy;
      const text =
        e.status === 'WITHIN'
          ? "Yesterday's energy total was within the planned range."
          : `Yesterday's energy total was ${e.status === 'ABOVE' ? 'above' : 'below'} the planned range by ${Math.abs(e.difference)} kcal${e.band === 'NOTICEABLE' ? ' (slightly)' : ''}.`;
      facts.push({ id: 'energy', kind: 'ENERGY', text, signature: `${e.status}:${e.band}` });
    }
  } else if (yesterday && yesterday.mealCount === 0) {
    facts.push({
      id: 'coverage',
      kind: 'COVERAGE',
      text: 'No meals were recorded yesterday.',
      signature: 'EMPTY',
    });
  }

  if (context.hasPlan && todaySlots.length > 0) {
    facts.push({
      id: 'today:plan',
      kind: 'TODAY_PLAN',
      text: `Today's plan, in order: ${todaySlots.map((s) => `${quoted(s)}${s.options.length > 1 ? ` (${s.options.length} options)` : ''}`).join(', ')}.`,
      signature: todaySlots.map((s) => s.id).join(','),
    });
    const recordedIds = new Set(
      today?.slots.filter((s) => s.state !== 'NOT_RECORDED').map((s) => s.slot.id) ?? [],
    );
    const next = todaySlots.find((s) => !recordedIds.has(s.id));
    if (next) {
      facts.push({
        id: 'today:next',
        kind: 'TODAY_NEXT',
        text: `The next unrecorded slot today is ${quoted(next)}.`,
        signature: next.id,
      });
    }
    if (today && today.mealCount > 0) {
      facts.push({
        id: 'today:recorded',
        kind: 'TODAY_RECORDED',
        text: `${today.mealCount} meal(s) have already been recorded today.`,
        signature: `${today.mealCount}`,
      });
    }
  } else if (!context.hasPlan) {
    facts.push({
      id: 'today:plan',
      kind: 'TODAY_PLAN',
      text: 'There is no active plan; comparisons are not available until a plan is added.',
      signature: 'NO_PLAN',
    });
  }

  return facts;
}

/** Stale only when a fact the paragraph used changed band or status, or disappeared. */
export function isReflectionStale(
  snapshot: ReflectionFact[],
  current: ReflectionFact[],
  usedFactIds: string[],
): boolean {
  const before = new Map(snapshot.map((f) => [f.id, f.signature]));
  const after = new Map(current.map((f) => [f.id, f.signature]));
  for (const id of usedFactIds) {
    if (!before.has(id)) continue;
    if (before.get(id) !== after.get(id)) return true;
  }
  return false;
}

export function factsHash(facts: ReflectionFact[]): string {
  const text = facts.map((f) => `${f.id}=${f.signature}`).join('|');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
