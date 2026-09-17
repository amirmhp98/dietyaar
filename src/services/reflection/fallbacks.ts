import type { ReflectionContext, ReflectionFact } from '@/lib/rubric/facts';
import { t } from '@/lib/t';
import { wordCount } from '@/services/ai/schemas';

/**
 * Deterministic fallback paragraphs (product spec § 11 "Distinct content
 * states"). Every sentence is template glue from the dictionary or the
 * verbatim text of a fact, so a fallback never says something its snapshot
 * does not contain, never claims the user confirmed completeness, and never
 * mentions training, exercise or fasting. `usedFactIds` lists the facts whose
 * text was included, which drives the staleness check like an AI paragraph.
 */
export type FallbackState =
  'COMPLETE' | 'UNCHECKED' | 'NO_RECORDS' | 'FIRST_DAY' | 'NO_PLAN' | 'PROVIDER_FAILURE';

export interface FallbackParagraph {
  paragraph: string;
  usedFactIds: string[];
}

export const FALLBACK_MIN_WORDS = 40;
export const FALLBACK_MAX_WORDS = 90;

const NEXT_PREFIX = 'The next unrecorded slot today is ';

function factById(facts: ReflectionFact[], id: string): ReflectionFact | undefined {
  return facts.find((f) => f.id === id);
}

/** The data state the facts describe; the provider failure state is chosen by the caller. */
export function pickFallbackState(
  facts: ReflectionFact[],
  context: Pick<ReflectionContext, 'hasPlan' | 'isFirstDay'>,
): Exclude<FallbackState, 'PROVIDER_FAILURE'> {
  if (context.isFirstDay) return 'FIRST_DAY';
  if (!context.hasPlan) return 'NO_PLAN';
  const coverage = factById(facts, 'coverage');
  if (!coverage || coverage.signature === 'EMPTY') return 'NO_RECORDS';
  const completeness = factById(facts, 'completeness');
  if (completeness && completeness.signature === 'false') return 'UNCHECKED';
  return 'COMPLETE';
}

interface Part {
  text: string;
  factIds?: string[];
  /** Optional parts are dropped, lowest priority first, when the paragraph runs long. */
  optional?: number;
}

function greeting(context: Pick<ReflectionContext, 'greetingName' | 'timeOfDay'>): Part {
  const name = context.greetingName;
  const text =
    context.timeOfDay === 'MORNING'
      ? t('reflection.fallback.greeting.morning', { name })
      : context.timeOfDay === 'AFTERNOON'
        ? t('reflection.fallback.greeting.afternoon', { name })
        : t('reflection.fallback.greeting.evening', { name });
  return { text };
}

function closing(context: Pick<ReflectionContext, 'timeOfDay'>): Part {
  const text =
    context.timeOfDay === 'MORNING'
      ? t('reflection.fallback.close.morning')
      : context.timeOfDay === 'AFTERNOON'
        ? t('reflection.fallback.close.afternoon')
        : t('reflection.fallback.close.evening');
  return { text };
}

/** Today's focus: the next slot by plan order, never a clock time (product spec § 11). */
function todayPart(facts: ReflectionFact[]): Part | null {
  const plan = factById(facts, 'today:plan');
  if (!plan || plan.signature === 'NO_PLAN') return null;
  const next = factById(facts, 'today:next');
  if (!next) return { text: t('reflection.fallback.today.allRecorded'), factIds: [plan.id] };
  const slot = next.text.startsWith(NEXT_PREFIX)
    ? next.text.slice(NEXT_PREFIX.length).replace(/\.$/, '')
    : null;
  if (slot === null) return { text: next.text, factIds: [next.id] };
  const firstSlotId = plan.signature.split(',')[0];
  const isFirst = next.signature === firstSlotId;
  return {
    text: isFirst
      ? t('reflection.fallback.today.startsWith', { slot })
      : t('reflection.fallback.today.next', { slot }),
    factIds: [next.id, plan.id],
  };
}

/** One thing that matched, and one focus in the product-spec priority: food or portion, then timing, then energy. */
function observations(facts: ReflectionFact[]): Part[] {
  const parts: Part[] = [];
  const matched = facts.find((f) => f.kind === 'SLOT' && f.signature.startsWith('MATCHED'));
  const focus =
    facts.find(
      (f) => (f.kind === 'SLOT' && !f.signature.startsWith('MATCHED')) || f.kind === 'PORTION',
    ) ??
    facts.find((f) => f.kind === 'TIMING') ??
    facts.find((f) => f.kind === 'ENERGY');
  if (matched) parts.push({ text: matched.text, factIds: [matched.id], optional: 1 });
  if (focus) parts.push({ text: focus.text, factIds: [focus.id], optional: 2 });
  return parts;
}

function assemble(parts: Array<Part | null>): FallbackParagraph {
  let kept = parts.filter((p): p is Part => p !== null);
  const words = () => wordCount(kept.map((p) => p.text).join(' '));
  // Too long: drop optional parts, lowest priority first.
  while (words() > FALLBACK_MAX_WORDS) {
    const optional = kept.filter((p) => p.optional !== undefined);
    if (optional.length === 0) break;
    const lowest = optional.reduce((a, b) => (a.optional! <= b.optional! ? a : b));
    kept = kept.filter((p) => p !== lowest);
  }
  // Too short: pad with a neutral reminder that states nothing about the log.
  if (words() < FALLBACK_MIN_WORDS) {
    const filler = t('reflection.fallback.anythingToAdd');
    if (!kept.some((p) => p.text === filler)) kept.push({ text: filler });
  }
  const usedFactIds = [...new Set(kept.flatMap((p) => p.factIds ?? []))];
  return { paragraph: kept.map((p) => p.text).join(' '), usedFactIds };
}

export function fallbackParagraph(
  state: FallbackState,
  facts: ReflectionFact[],
  context: Pick<ReflectionContext, 'greetingName' | 'timeOfDay'>,
): FallbackParagraph {
  const coverage = factById(facts, 'coverage');
  const score = factById(facts, 'score');
  switch (state) {
    case 'FIRST_DAY': {
      const plan = factById(facts, 'today:plan');
      const hasPlan = plan && plan.signature !== 'NO_PLAN';
      return assemble([
        greeting(context),
        { text: t('reflection.fallback.firstDay.welcome') },
        hasPlan
          ? { text: plan.text, factIds: [plan.id] }
          : { text: t('reflection.fallback.firstDay.noPlan') },
        hasPlan ? { text: t('reflection.fallback.firstDay.plan') } : null,
        closing(context),
      ]);
    }
    case 'NO_PLAN':
      return assemble([
        greeting(context),
        coverage ? { text: coverage.text, factIds: [coverage.id], optional: 1 } : null,
        { text: t('reflection.fallback.noPlan.body') },
        closing(context),
      ]);
    case 'NO_RECORDS':
      return assemble([
        greeting(context),
        { text: t('reflection.fallback.noRecords.body'), factIds: coverage ? [coverage.id] : [] },
        todayPart(facts),
        closing(context),
      ]);
    case 'UNCHECKED': {
      const completeness = factById(facts, 'completeness');
      return assemble([
        greeting(context),
        {
          text: t('reflection.fallback.unchecked.intro'),
          factIds: completeness ? [completeness.id] : [],
        },
        ...observations(facts),
        { text: t('reflection.fallback.anythingToAdd'), optional: 3 },
        todayPart(facts),
        closing(context),
      ]);
    }
    case 'COMPLETE':
      return assemble([
        greeting(context),
        { text: t('reflection.fallback.complete.intro') },
        coverage ? { text: coverage.text, factIds: [coverage.id] } : null,
        score ? { text: score.text, factIds: [score.id], optional: 0 } : null,
        ...observations(facts),
        todayPart(facts),
        closing(context),
      ]);
    case 'PROVIDER_FAILURE':
    default:
      return assemble([
        greeting(context),
        { text: t('reflection.fallback.providerFailure.body') },
        todayPart(facts),
        closing(context),
      ]);
  }
}
