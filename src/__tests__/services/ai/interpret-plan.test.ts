import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanImportOutput } from '@/services/ai/schemas';
import type { AiResult } from '@/services/ai/types';

vi.mock('@/services/ai/deepseek', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/ai/deepseek')>();
  return { ...actual, complete: vi.fn() };
});

import { complete } from '@/services/ai/deepseek';
import {
  estimatePlanBaseline,
  interpretPlan,
  mergeChunks,
  sanitizeExcerpts,
  splitByWeekday,
  weekdayHeading,
} from '@/services/ai/interpret-plan';

const completeMock = vi.mocked(complete);

const WEEKDAY_PLAN = [
  'برنامه غذایی هفتگی',
  'روزانه حدود ۲۲۰۰ کالری',
  '',
  'شنبه (روز تمرین)',
  'صبحانه: ۲ عدد تخم‌مرغ آب‌پز، یک کف دست نان سنگک',
  'ناهار: ۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج',
  'شام: سیب‌زمینی آب‌پز یا تنوری ۱۵۰ گرم',
  '',
  'یکشنبه (روز استراحت)',
  'صبحانه: یک لیوان شیر کم‌چرب، ۳ عدد خرما',
  'ناهار: کباب تابه‌ای یا همبرگر خانگی',
  'شام: عدسی یک کاسه',
  '',
  'شنبه‌ها ماهی بخورید',
].join('\n');

function slot(name: string, weekday = 7): PlanImportOutput['slots'][number] {
  return {
    originalName: name,
    englishLabel: name,
    weekday,
    timeStart: null,
    timeEnd: null,
    sourceExcerpt: '',
    options: [{ label: null, items: [] }],
  };
}

function output(overrides: Partial<PlanImportOutput> = {}): PlanImportOutput {
  return {
    structure: 'SAME_EVERY_DAY',
    name: null,
    sourceLanguage: null,
    slots: [],
    targets: [],
    rules: [],
    notes: [],
    uncertainties: [],
    ...overrides,
  };
}

function okResult<T>(data: T): AiResult<T> {
  return {
    ok: true,
    data,
    attempts: [{ model: 'm', durationMs: 3, outcome: 'OK' }],
    usage: { promptTokens: 10, completionTokens: 5 },
    model: 'm',
    durationMs: 3,
  };
}

beforeEach(() => {
  completeMock.mockReset();
});

describe('weekdayHeading', () => {
  it('recognises Persian and English weekday headings', () => {
    expect(weekdayHeading('شنبه')).toBe(6);
    expect(weekdayHeading('شنبه (روز تمرین)')).toBe(6);
    expect(weekdayHeading('روز یکشنبه:')).toBe(0);
    expect(weekdayHeading('## پنج‌شنبه')).toBe(4);
    expect(weekdayHeading('پنجشنبه - رست')).toBe(4);
    expect(weekdayHeading('جمعه')).toBe(5);
    expect(weekdayHeading('Saturday: training day')).toBe(6);
    expect(weekdayHeading('3. Wednesday')).toBe(3);
  });

  it('ignores lines that merely start with a weekday word', () => {
    expect(weekdayHeading('شنبه‌ها ماهی بخورید')).toBeNull();
    expect(weekdayHeading('Saturdays are for fish')).toBeNull();
    expect(weekdayHeading('صبحانه: ۲ عدد تخم‌مرغ')).toBeNull();
  });
});

describe('splitByWeekday', () => {
  it('chunks a weekday plan and keeps the preamble with the first chunk', () => {
    const chunks = splitByWeekday(WEEKDAY_PLAN);
    expect(chunks?.map((c) => c.weekday)).toEqual([6, 0]);
    expect(chunks![0]!.text.startsWith('برنامه غذایی هفتگی')).toBe(true);
    expect(chunks![0]!.text).toContain('۱۵۰ گرم مرغ گریل');
    expect(chunks![1]!.text.startsWith('یکشنبه')).toBe(true);
    expect(chunks![1]!.text).toContain('شنبه‌ها ماهی بخورید');
  });

  it('falls back to one call for a menu plan and for repeated weekdays', () => {
    expect(splitByWeekday('صبحانه\nناهار\nشام')).toBeNull();
    expect(splitByWeekday('شنبه\nx\nشنبه\ny')).toBeNull();
    expect(splitByWeekday('شنبه\nx')).toBeNull();
  });
});

describe('sanitizeExcerpts', () => {
  it('blanks excerpts that are not substrings of the source or its parsing copy', () => {
    const cleaned = sanitizeExcerpts(
      output({
        slots: [
          {
            ...slot('ناهار'),
            sourceExcerpt: 'ناهار: 150 گرم مرغ گریل',
            options: [
              {
                label: null,
                items: [
                  {
                    originalName: 'مرغ',
                    englishLabel: 'Chicken',
                    quantity: 150,
                    unit: 'g',
                    quantityAssumed: false,
                    assumedDefaultKey: null,
                    preparationNote: null,
                    alternatives: [],
                    category: 'MEAT',
                    nutrition: null,
                    sourceExcerpt: 'invented text',
                  },
                ],
              },
            ],
          },
        ],
        targets: [
          {
            slotIndex: null,
            weekday: null,
            nutrient: 'ENERGY_KCAL',
            type: 'APPROXIMATE',
            low: 2200,
            high: null,
            sourceExcerpt: 'حدود 2200 کالری',
          },
        ],
        rules: [
          {
            kind: 'INSTRUCTION',
            period: null,
            definition: {},
            originalText: 'x',
            sourceExcerpt: 'not there',
            isConflicting: false,
            unsupportedReason: null,
          },
        ],
      }),
      WEEKDAY_PLAN,
    );
    expect(cleaned.slots[0]!.sourceExcerpt).toBe('ناهار: 150 گرم مرغ گریل');
    expect(cleaned.slots[0]!.options[0]!.items[0]!.sourceExcerpt).toBe('');
    expect(cleaned.targets[0]!.sourceExcerpt).toBe('حدود 2200 کالری');
    expect(cleaned.rules[0]!.sourceExcerpt).toBe('');
  });
});

describe('mergeChunks', () => {
  it('re-bases slot indices and stamps weekdays', () => {
    const merged = mergeChunks([
      {
        weekday: 6,
        output: output({
          name: 'Plan',
          slots: [slot('صبحانه'), slot('ناهار')],
          targets: [
            {
              slotIndex: 1,
              weekday: null,
              nutrient: 'ENERGY_KCAL',
              type: 'RANGE',
              low: 500,
              high: 600,
              sourceExcerpt: null,
            },
            {
              slotIndex: null,
              weekday: null,
              nutrient: 'ENERGY_KCAL',
              type: 'APPROXIMATE',
              low: 2200,
              high: null,
              sourceExcerpt: null,
            },
          ],
          rules: [
            {
              kind: 'INSTRUCTION',
              period: null,
              definition: {},
              originalText: 'r',
              sourceExcerpt: '',
              isConflicting: false,
              unsupportedReason: null,
            },
          ],
          notes: [{ originalText: 'n', reason: 'DAY_TYPE' }],
        }),
      },
      {
        weekday: 0,
        output: output({
          slots: [slot('شام')],
          targets: [
            {
              slotIndex: 0,
              weekday: null,
              nutrient: 'ENERGY_KCAL',
              type: 'RANGE',
              low: 400,
              high: 500,
              sourceExcerpt: null,
            },
          ],
          rules: [
            {
              kind: 'INSTRUCTION',
              period: null,
              definition: {},
              originalText: 'r',
              sourceExcerpt: '',
              isConflicting: false,
              unsupportedReason: null,
            },
          ],
          notes: [{ originalText: 'n', reason: 'DAY_TYPE' }],
          uncertainties: [
            { slotIndex: 0, optionIndex: 0, itemIndex: 0, question: 'How much?' },
            { slotIndex: 5, optionIndex: 0, itemIndex: 0, question: 'out of range' },
          ],
        }),
      },
    ]);
    expect(merged.structure).toBe('BY_WEEKDAY');
    expect(merged.name).toBe('Plan');
    expect(merged.slots.map((s) => [s.originalName, s.weekday])).toEqual([
      ['صبحانه', 6],
      ['ناهار', 6],
      ['شام', 0],
    ]);
    expect(merged.targets.map((t) => [t.slotIndex, t.weekday])).toEqual([
      [1, 6],
      [null, null],
      [2, 0],
    ]);
    expect(merged.rules).toHaveLength(1);
    expect(merged.notes).toHaveLength(1);
    expect(merged.uncertainties).toEqual([
      { slotIndex: 2, optionIndex: 0, itemIndex: 0, question: 'How much?' },
    ]);
  });
});

describe('interpretPlan', () => {
  const base = {
    profile: { ageYears: 30, sex: 'FEMALE' as const, heightCm: 168, weightKg: 64 },
    userTag: 'tag',
  };

  it('makes one call for a menu plan and sanitises excerpts', async () => {
    completeMock.mockResolvedValueOnce(
      okResult(output({ slots: [{ ...slot('صبحانه'), sourceExcerpt: 'nowhere' }] })),
    );
    const result = await interpretPlan({
      ...base,
      sourceText: 'صبحانه: ۲ تخم‌مرغ',
      deadlineAt: Date.now() + 120_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slots[0]!.sourceExcerpt).toBe('');
    expect(completeMock).toHaveBeenCalledTimes(1);
    const call = completeMock.mock.calls[0]![0];
    expect(call.kind).toBe('PLAN_IMPORT');
    expect(call.system.startsWith('# dietyaar:PLAN_IMPORT v1')).toBe(true);
    // The parsing copy is sent: Persian digits normalised.
    expect(call.user).toContain('صبحانه: 2 تخم‌مرغ');
    expect(call.user).not.toContain('۲');
  });

  it('calls once per weekday chunk, divides the budget and merges the chunks', async () => {
    completeMock
      .mockResolvedValueOnce(
        okResult(output({ slots: [slot('صبحانه'), slot('ناهار'), slot('شام')] })),
      )
      .mockResolvedValueOnce(
        okResult(output({ slots: [slot('صبحانه'), slot('ناهار'), slot('شام')] })),
      );
    const start = Date.now();
    const result = await interpretPlan({
      ...base,
      sourceText: WEEKDAY_PLAN,
      deadlineAt: start + 120_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(completeMock).toHaveBeenCalledTimes(2);
    const [first, second] = completeMock.mock.calls.map((c) => c[0]);
    expect(first!.user).toContain('Chunk weekday: 6 (Saturday)');
    expect(second!.user).toContain('Chunk weekday: 0 (Sunday)');
    // First chunk gets half the budget; the second gets what remains.
    expect(first!.deadlineAt).toBeLessThanOrEqual(start + 60_100);
    expect(first!.deadlineAt).toBeGreaterThan(start + 59_000);
    expect(second!.deadlineAt).toBeGreaterThan(first!.deadlineAt);
    expect(result.data.structure).toBe('BY_WEEKDAY');
    expect(result.data.slots.map((s) => s.weekday)).toEqual([6, 6, 6, 0, 0, 0]);
    expect(result.attempts).toHaveLength(2);
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 10 });
  });

  it('fails the whole import when a chunk fails, keeping every attempt', async () => {
    completeMock
      .mockResolvedValueOnce(okResult(output({ slots: [slot('صبحانه')] })))
      .mockResolvedValueOnce({
        ok: false,
        reason: 'TIMEOUT',
        attempts: [{ model: 'm', durationMs: 1, outcome: 'TIMEOUT' }],
        usage: { promptTokens: 0, completionTokens: 0 },
        durationMs: 1,
      });
    const result = await interpretPlan({
      ...base,
      sourceText: WEEKDAY_PLAN,
      deadlineAt: Date.now() + 120_000,
    });
    expect(result).toMatchObject({ ok: false, reason: 'TIMEOUT' });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['OK', 'TIMEOUT']);
  });
});

describe('estimatePlanBaseline', () => {
  it('skips the call for no items and labels every estimate', async () => {
    const empty = await estimatePlanBaseline({
      items: [],
      deadlineAt: Date.now() + 1000,
      userTag: 't',
    });
    expect(empty).toMatchObject({ ok: true, data: { items: [] } });
    expect(completeMock).not.toHaveBeenCalled();

    completeMock.mockResolvedValueOnce(
      okResult({
        items: [
          {
            index: 0,
            nutrition: {
              basis: 'PER_RECORDED_PORTION' as const,
              basisQuantity: 2,
              basisUnit: 'egg',
              values: {
                ENERGY_KCAL: 155,
                PROTEIN_G: 12.6,
                CARB_G: 1.1,
                FAT_G: 10.6,
                FIBER_G: null,
                SODIUM_MG: null,
              },
              source: 'USDA' as const,
              sourceRef: null,
              isEstimate: false,
              userOverride: false,
            },
          },
          { index: 9, nutrition: null },
        ],
      }),
    );
    const result = await estimatePlanBaseline({
      items: [
        {
          index: 0,
          originalName: 'تخم‌مرغ',
          englishLabel: 'Egg',
          quantity: 2,
          unit: 'egg',
          preparationNote: null,
          category: 'MEAT',
        },
      ],
      deadlineAt: Date.now() + 1000,
      userTag: 't',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]!.nutrition).toMatchObject({
      source: 'AI_ESTIMATE',
      isEstimate: true,
    });
    expect(completeMock.mock.calls[0]![0].kind).toBe('PLAN_BASELINE');
  });
});
