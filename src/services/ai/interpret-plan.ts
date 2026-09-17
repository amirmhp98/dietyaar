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
import type { AiResult, EstimateBaselineInput, InterpretPlanInput } from '@/services/ai/types';

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

export function weekdayHeading(line: string): number | null {
  const rest = line.replace(HEADING_PREFIX, '');
  for (const [pattern, weekday] of WEEKDAY_HEADINGS) {
    const match = pattern.exec(rest);
    if (match && HEADING_SUFFIX.test(rest.slice(match[0].length))) return weekday;
  }
  return null;
}

export interface WeekdayChunk {
  weekday: number;
  text: string;
}

/**
 * Splits normalised plan text at weekday headings. Returns null unless at
 * least two distinct weekdays head their own sections (then one call per
 * chunk); text before the first heading joins the first chunk.
 */
export function splitByWeekday(normalizedText: string): WeekdayChunk[] | null {
  const lines = normalizedText.split(/\r?\n/);
  const sections: Array<{ weekday: number | null; lines: string[] }> = [
    { weekday: null, lines: [] },
  ];
  for (const line of lines) {
    const weekday = weekdayHeading(line);
    if (weekday !== null) sections.push({ weekday, lines: [line] });
    else sections[sections.length - 1]!.lines.push(line);
  }
  const headed = sections.filter((s) => s.weekday !== null);
  const weekdays = new Set(headed.map((s) => s.weekday));
  if (headed.length < 2 || headed.length > 7 || weekdays.size !== headed.length) return null;
  const preamble = sections[0]!.lines.join('\n').trim();
  return headed.map((section, index) => ({
    weekday: section.weekday!,
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

/** Concatenates weekday chunks: slots get their chunk's weekday and indices are re-based. */
export function mergeChunks(
  chunks: Array<{ weekday: number; output: PlanImportOutput }>,
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
  for (const { weekday, output } of chunks) {
    const offset = merged.slots.length;
    merged.name ??= output.name;
    merged.sourceLanguage ??= output.sourceLanguage;
    merged.slots.push(...output.slots.map((slot) => ({ ...slot, weekday })));
    for (const target of output.targets) {
      if (target.slotIndex === null) {
        merged.targets.push(target);
      } else if (target.slotIndex < output.slots.length) {
        merged.targets.push({ ...target, slotIndex: target.slotIndex + offset, weekday });
      }
    }
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
    for (const u of output.uncertainties) {
      if (u.slotIndex < output.slots.length)
        merged.uncertainties.push({ ...u, slotIndex: u.slotIndex + offset });
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
  const outputs: Array<{ weekday: number; output: PlanImportOutput }> = [];
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
        chunkWeekday: chunk.weekday,
        chunkPosition: { index, total: chunks.length },
      }),
      schema: planImportOutputSchema,
      deadlineAt: chunkDeadline,
      maxTokens: PLAN_IMPORT_MAX_TOKENS,
      userTag: input.userTag,
    });
    results.push(result);
    if (!result.ok) return { ok: false, reason: result.reason, ...mergeMeta(results) };
    outputs.push({ weekday: chunk.weekday, output: result.data });
  }
  const last = results[results.length - 1]!;
  return {
    ok: true,
    data: sanitizeExcerpts(mergeChunks(outputs), input.sourceText, normalized),
    model: last.ok ? last.model : '',
    ...mergeMeta(results),
  };
}

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
  const result = await complete({
    kind: 'PLAN_BASELINE',
    system: planBaselineSystemPrompt(),
    user: planBaselineUserMessage(input.items),
    schema: planBaselineOutputSchema,
    deadlineAt: input.deadlineAt,
    maxTokens: PLAN_BASELINE_MAX_TOKENS,
    userTag: input.userTag,
  });
  if (!result.ok) return result;
  const requested = new Set(input.items.map((item) => item.index));
  const items = result.data.items
    .filter((item) => requested.has(item.index))
    .map((item) => ({
      index: item.index,
      nutrition:
        item.nutrition === null
          ? null
          : { ...item.nutrition, source: 'AI_ESTIMATE' as const, isEstimate: true },
    }));
  return { ...result, data: { items } };
}
