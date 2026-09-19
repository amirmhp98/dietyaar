import { normalizeInput } from '@/lib/text/normalize';
import { complete, mergeMeta } from '@/services/ai/deepseek';
import {
  PLAN_BASELINE_MAX_TOKENS,
  planBaselineSystemPrompt,
  planBaselineUserMessage,
} from '@/services/ai/prompts/plan-baseline';
import {
  PLAN_IMPORT_MAX_TOKENS,
  planImportSystemPrompt,
  planImportUserMessage,
} from '@/services/ai/prompts/plan-import';
import {
  planBaselineOutputSchema,
  planImportOutputSchema,
  type PlanBaselineOutput,
  type PlanImportOutput,
} from '@/services/ai/schemas';
import type {
  BaselineItemInput,
  AiResult,
  EstimateBaselineInput,
  InterpretPlanInput,
} from '@/services/ai/types';

/**
 * Plan import (tech spec § 10.2): BY_WEEKDAY text is split at weekday
 * headings and interpreted one chunk at a time, each with the remaining
 * budget divided by the remaining chunks; the chunks merge into one output.
 * Every `sourceExcerpt` is then checked to be a substring of the source
 * (tech spec § 8). Nothing is persisted here.
 */

/** Weekday index (0 = Sunday … 6 = Saturday) by heading, longest spellings first. */
const WEEKDAY_HEADINGS: Array<[RegExp, number]> = [
  [/^(?:یکشنبه|یک‌شنبه|یک شنبه|sunday)/iu, 0],
  [/^(?:دوشنبه|دو‌شنبه|دو شنبه|monday)/iu, 1],
  [/^(?:سه‌شنبه|سه شنبه|سهشنبه|tuesday)/iu, 2],
  [/^(?:چهارشنبه|چهار‌شنبه|چهار شنبه|wednesday)/iu, 3],
  [/^(?:پنجشنبه|پنج‌شنبه|پنج شنبه|thursday)/iu, 4],
  [/^(?:جمعه|friday)/iu, 5],
  [/^(?:شنبه|saturday)/iu, 6],
];
/** Bullet, numbering and markdown noise allowed before a heading. */
const HEADING_PREFIX = /^[\s#*_\-–—•·>[\]()\d.:]*(?:روز\s+)?/u;
/** What may follow the weekday name for the line to count as a heading. */
const HEADING_SUFFIX = /^(?:$|[\s:：\-–—(\[،,*_.)])/u;
/** "شنبه تا پنجشنبه", "Monday to Friday", "Mon–Fri": the words and dashes that join a range. */
const RANGE_SEPARATOR = /^\s*(?:تا|الی|to|till|until|through|[-–—])\s*/iu;

function matchWeekday(text: string): { weekday: number; length: number } | null {
  for (const [pattern, weekday] of WEEKDAY_HEADINGS) {
    const match = pattern.exec(text);
    if (match) return { weekday, length: match[0].length };
  }
  return null;
}

/** Every weekday from `from` to `to` inclusive, walking forward around the week. */
function weekdayRange(from: number, to: number): number[] {
  const days = [from];
  for (let day = from; day !== to;) {
    day = (day + 1) % 7;
    days.push(day);
  }
  return days;
}

/**
 * The weekdays a heading line stands for: one for "جمعه:", the whole span for
 * a range such as "شنبه تا پنجشنبه:" (a common Sat–Thu / Friday layout), or
 * null when the line is not a heading.
 */
export function weekdayHeading(line: string): number[] | null {
  const rest = line.replace(HEADING_PREFIX, '');
  const first = matchWeekday(rest);
  if (!first) return null;
  const afterFirst = rest.slice(first.length);
  const separator = RANGE_SEPARATOR.exec(afterFirst);
  if (separator) {
    const afterSeparator = afterFirst.slice(separator[0].length);
    const second = matchWeekday(afterSeparator);
    if (second && HEADING_SUFFIX.test(afterSeparator.slice(second.length))) {
      return weekdayRange(first.weekday, second.weekday);
    }
  }
  return HEADING_SUFFIX.test(afterFirst) ? [first.weekday] : null;
}

export interface WeekdayChunk {
  /** The days this chunk's text applies to, in plan order; one for a single-day heading. */
  weekdays: number[];
  text: string;
}

/**
 * Splits normalised plan text at weekday headings. Returns null unless at
 * least two sections head their own distinct weekdays (then one call per
 * chunk); text before the first heading joins the first chunk.
 */
export function splitByWeekday(normalizedText: string): WeekdayChunk[] | null {
  const lines = normalizedText.split(/\r?\n/);
  const sections: Array<{ weekdays: number[] | null; lines: string[] }> = [
    { weekdays: null, lines: [] },
  ];
  for (const line of lines) {
    const weekdays = weekdayHeading(line);
    if (weekdays) sections.push({ weekdays, lines: [line] });
    else sections[sections.length - 1]!.lines.push(line);
  }
  const headed = sections.filter((s) => s.weekdays !== null);
  const covered = headed.flatMap((s) => s.weekdays!);
  if (headed.length < 2 || new Set(covered).size !== covered.length) return null;
  const preamble = sections[0]!.lines.join('\n').trim();
  return headed.map((section, index) => ({
    weekdays: section.weekdays!,
    text:
      index === 0 && preamble
        ? `${preamble}\n${section.lines.join('\n')}`.trim()
        : section.lines.join('\n').trim(),
  }));
}

/** Every excerpt must be a verbatim substring of the source (or its parsing copy) or it is dropped. */
export function sanitizeExcerpts(
  output: PlanImportOutput,
  sourceText: string,
  normalizedText: string = normalizeInput(sourceText),
): PlanImportOutput {
  const keep = (excerpt: string | null): boolean =>
    excerpt === null ||
    excerpt === '' ||
    sourceText.includes(excerpt) ||
    normalizedText.includes(excerpt);
  const clean = (excerpt: string): string => (keep(excerpt) ? excerpt : '');
  return {
    ...output,
    slots: output.slots.map((slot) => ({
      ...slot,
      sourceExcerpt: clean(slot.sourceExcerpt),
      options: slot.options.map((option) => ({
        ...option,
        items: option.items.map((item) => ({ ...item, sourceExcerpt: clean(item.sourceExcerpt) })),
      })),
    })),
    targets: output.targets.map((target) => ({
      ...target,
      sourceExcerpt: keep(target.sourceExcerpt) ? target.sourceExcerpt : null,
    })),
    rules: output.rules.map((rule) => ({ ...rule, sourceExcerpt: clean(rule.sourceExcerpt) })),
  };
}

/**
 * Concatenates weekday chunks: slots get their chunk's weekday and indices are
 * re-based. A range chunk repeats its slots, slot targets and questions for
 * every day of the range; rules, notes and every-day targets appear once.
 */
export function mergeChunks(
  chunks: Array<{ weekdays: number[]; output: PlanImportOutput }>,
): PlanImportOutput {
  const merged: PlanImportOutput = {
    structure: 'BY_WEEKDAY',
    name: null,
    sourceLanguage: null,
    slots: [],
    targets: [],
    rules: [],
    notes: [],
    uncertainties: [],
  };
  const seenRules = new Set<string>();
  const seenNotes = new Set<string>();
  for (const { weekdays, output } of chunks) {
    merged.name ??= output.name;
    merged.sourceLanguage ??= output.sourceLanguage;
    for (const rule of output.rules) {
      const key = `${rule.kind}:${rule.originalText}`;
      if (seenRules.has(key)) continue;
      seenRules.add(key);
      merged.rules.push(rule);
    }
    for (const note of output.notes) {
      if (seenNotes.has(note.originalText)) continue;
      seenNotes.add(note.originalText);
      merged.notes.push(note);
    }
    for (const [dayIndex, weekday] of weekdays.entries()) {
      const offset = merged.slots.length;
      merged.slots.push(...output.slots.map((slot) => ({ ...slot, weekday })));
      for (const target of output.targets) {
        if (target.slotIndex === null) {
          if (target.weekday !== null) merged.targets.push({ ...target, weekday });
          else if (dayIndex === 0) merged.targets.push(target);
        } else if (target.slotIndex < output.slots.length) {
          merged.targets.push({ ...target, slotIndex: target.slotIndex + offset, weekday });
        }
      }
      for (const u of output.uncertainties) {
        if (u.slotIndex < output.slots.length)
          merged.uncertainties.push({ ...u, slotIndex: u.slotIndex + offset });
      }
    }
  }
  return merged;
}

export async function interpretPlan(
  input: InterpretPlanInput,
): Promise<AiResult<PlanImportOutput>> {
  const normalized = normalizeInput(input.sourceText);
  const system = planImportSystemPrompt();
  const chunks = splitByWeekday(normalized);

  if (!chunks) {
    const result = await complete({
      kind: 'PLAN_IMPORT',
      system,
      user: planImportUserMessage({ sourceText: normalized, profile: input.profile }),
      schema: planImportOutputSchema,
      deadlineAt: input.deadlineAt,
      maxTokens: PLAN_IMPORT_MAX_TOKENS,
      userTag: input.userTag,
    });
    if (!result.ok) return result;
    return { ...result, data: sanitizeExcerpts(result.data, input.sourceText, normalized) };
  }

  const results: Array<AiResult<PlanImportOutput>> = [];
  const outputs: Array<{ weekdays: number[]; output: PlanImportOutput }> = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    const now = Date.now();
    const remainingChunks = chunks.length - index;
    const chunkDeadline = now + Math.floor(Math.max(0, input.deadlineAt - now) / remainingChunks);
    const result = await complete({
      kind: 'PLAN_IMPORT',
      system,
      user: planImportUserMessage({
        sourceText: chunk.text,
        profile: input.profile,
        // A range chunk is interpreted once, under its first day; the merge repeats it.
        chunkWeekday: chunk.weekdays[0],
        chunkPosition: { index, total: chunks.length },
      }),
      schema: planImportOutputSchema,
      deadlineAt: chunkDeadline,
      maxTokens: PLAN_IMPORT_MAX_TOKENS,
      userTag: input.userTag,
    });
    results.push(result);
    if (!result.ok) return { ok: false, reason: result.reason, ...mergeMeta(results) };
    outputs.push({ weekdays: chunk.weekdays, output: result.data });
  }
  const last = results[results.length - 1]!;
  return {
    ok: true,
    data: sanitizeExcerpts(mergeChunks(outputs), input.sourceText, normalized),
    model: last.ok ? last.model : '',
    ...mergeMeta(results),
  };
}

/** Items per baseline call: a 35-slot weekday plan (~90 items) overflowed the output budget in one call. */
export const BASELINE_BATCH_SIZE = 20;

export async function estimatePlanBaseline(
  input: EstimateBaselineInput,
): Promise<AiResult<PlanBaselineOutput>> {
  if (input.items.length === 0) {
    return {
      ok: true,
      data: { items: [] },
      attempts: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      model: '',
      durationMs: 0,
    };
  }
  const batches: BaselineItemInput[][] = [];
  for (let i = 0; i < input.items.length; i += BASELINE_BATCH_SIZE) {
    batches.push(input.items.slice(i, i + BASELINE_BATCH_SIZE));
  }
  const results: Array<AiResult<PlanBaselineOutput>> = [];
  const items: PlanBaselineOutput['items'] = [];
  let model = '';
  for (const [i, batch] of batches.entries()) {
    // Divide what is left of the operation deadline over the remaining batches.
    const remaining = Math.max(0, input.deadlineAt - Date.now());
    const deadlineAt = Date.now() + Math.floor(remaining / (batches.length - i));
    const result = await complete({
      kind: 'PLAN_BASELINE',
      system: planBaselineSystemPrompt(),
      user: planBaselineUserMessage(batch),
      schema: planBaselineOutputSchema,
      deadlineAt,
      maxTokens: PLAN_BASELINE_MAX_TOKENS,
      userTag: input.userTag,
    });
    results.push(result);
    if (!result.ok) return { ...result, ...mergeMeta(results) };
    model = result.model;
    const requested = new Set(batch.map((item) => item.index));
    for (const item of result.data.items) {
      if (!requested.has(item.index)) continue;
      items.push({
        index: item.index,
        nutrition:
          item.nutrition === null
            ? null
            : { ...item.nutrition, source: 'AI_ESTIMATE' as const, isEstimate: true },
      });
    }
  }
  return { ok: true, data: { items }, model, ...mergeMeta(results) };
}
