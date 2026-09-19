import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { env } from '@/lib/env';
import { analyzeMeal } from '@/services/ai/analyze-meal';
import { checkReflection, generateReflection } from '@/services/ai/generate-reflection';
import { estimatePlanBaseline, interpretPlan } from '@/services/ai/interpret-plan';
import { reflectionUserMessage } from '@/services/ai/prompts/reflection';
import {
  mealAnalysisOutputSchema,
  planImportOutputSchema,
  reflectionOutputSchema,
} from '@/services/ai/schemas';
import type { GenerateReflectionInput } from '@/services/ai/types';
import { reflectionFacts } from '@/lib/rubric/facts';

/**
 * The Playwright stub (e2e/stub-ai/server.mjs) must speak the adapter's
 * protocol: marker-based kind detection, scenario tokens, canned outputs that
 * pass the real schemas. Runs the stub in-process on a random port.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Stub = { server: import('node:http').Server; [fn: string]: any };
let stub: Stub;
let baseUrl: string;
const mutableEnv = env as { DEEPSEEK_API_BASE_URL: string };
const originalBase = env.DEEPSEEK_API_BASE_URL;

const profile = { ageYears: 30, sex: 'FEMALE' as const, heightCm: 168, weightKg: 64 };

beforeAll(async () => {
  stub = (await import('../../../../e2e/stub-ai/server.mjs')) as unknown as Stub;
  await new Promise<void>((resolve) => stub.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(stub.server.address() as AddressInfo).port}`;
  mutableEnv.DEEPSEEK_API_BASE_URL = baseUrl;
});
afterAll(async () => {
  mutableEnv.DEEPSEEK_API_BASE_URL = originalBase;
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
});

describe('canned outputs match the schemas', () => {
  it('menu plan, weekday plan and chunks', () => {
    const menu = planImportOutputSchema.parse(stub.menuPlan());
    expect(menu.slots).toHaveLength(5);
    expect(menu.slots[0]!.options).toHaveLength(3);
    expect(menu.slots[2]!.options).toHaveLength(4);
    expect(menu.targets.filter((t) => t.slotIndex !== null)).toHaveLength(5);
    expect(menu.notes[0]!.reason).toBe('TRAINING_CONDITIONAL');
    expect(menu.rules[0]!.kind).toBe('SERVING_COUNT');
    const week = planImportOutputSchema.parse(stub.weekdayPlan());
    expect(week.slots).toHaveLength(21);
    expect(week.slots[0]!.weekday).toBe(6);
    for (let d = 0; d < 7; d += 1)
      expect(planImportOutputSchema.parse(stub.weekdayChunk(d)).slots).toHaveLength(3);
  });

  it('meal analyses', () => {
    const known = mealAnalysisOutputSchema.parse(
      stub.mealAnalysis(
        'Meal description (data, verbatim):\n<<<\n2 تخم‌مرغ و یک نان سنگک و ماست\n>>>',
      ),
    );
    expect(known.items.map((i) => i.englishLabel)).toEqual(['Egg', 'Sangak bread', 'Yogurt']);
    expect(known.items[0]!.quantity).toBe(2);
    const unknown = mealAnalysisOutputSchema.parse(stub.mealAnalysis('<<<\nآبگوشت\n>>>'));
    expect(unknown.items[0]).toMatchObject({ category: 'OTHER', quantityUnknown: true });
    expect(unknown.questions[0]!.kind).toBe('PORTION');
  });

  it('SUGGEST names the first slot of the plan context, option 0', () => {
    const slots = [
      { originalName: 'ناهار', englishLabel: 'Lunch', options: [{ label: null, items: [] }] },
      { originalName: 'شام', englishLabel: 'Dinner', options: [{ label: null, items: [] }] },
    ];
    const output = mealAnalysisOutputSchema.parse(
      stub.mealAnalysis(
        `Today's plan slots and options (data):\n${JSON.stringify(slots, null, 1)}\n\nMeal description (data, verbatim):\n<<<\nماست SUGGEST\n>>>`,
      ),
    );
    expect(output.suggestedSlot).toEqual({ originalName: 'ناهار', englishLabel: 'Lunch' });
    expect(output.suggestedOptionIndex).toBe(0);
    // Without a plan context there is nothing to suggest.
    expect(stub.mealAnalysis('<<<\nماست SUGGEST\n>>>').suggestedSlot).toBeNull();
  });

  it('ASK makes the first item quantity-unknown with one portion question', () => {
    const output = mealAnalysisOutputSchema.parse(
      stub.mealAnalysis('<<<\nیک نان سنگک و ماست ASK\n>>>'),
    );
    expect(output.items[0]).toMatchObject({
      englishLabel: 'Sangak bread',
      quantity: null,
      unit: null,
      quantityUnknown: true,
      nutrition: null,
    });
    expect(output.items[1]!.quantity).toBe(150);
    expect(output.questions).toEqual([
      {
        itemIndex: 0,
        question: 'How much of this did you eat?',
        kind: 'PORTION',
        choices: ['1 slice', '2 slices', '3 slices'],
      },
    ]);
  });

  it('REFINE echoes the current items and fills answered portions', () => {
    const current = [
      {
        key: 'a',
        originalName: 'پیتزا',
        englishLabel: 'Pizza',
        quantity: null,
        unit: null,
        quantityUnknown: true,
        preparation: null,
        category: 'OTHER',
        answer: '2 slices',
      },
      {
        key: 'b',
        originalName: 'نوشابه',
        englishLabel: 'Soda',
        quantity: 1,
        unit: 'glass',
        quantityUnknown: false,
        preparation: null,
        category: 'OTHER',
        answer: null,
      },
    ];
    const raw = stub.mealAnalysis(
      `Mode: REFINE\nCurrent items (data):\n${JSON.stringify(current, null, 1)}`,
    );
    const output = mealAnalysisOutputSchema.parse(raw);
    expect(
      output.items.map((i) => [i.englishLabel, i.quantity, i.unit, i.quantityUnknown]),
    ).toEqual([
      ['Pizza', 2, 'serving', false],
      ['Soda', 1, 'glass', false],
    ]);
    expect(output.items[0]!.nutrition!.values).toMatchObject({
      ENERGY_KCAL: 200,
      PROTEIN_G: 10,
      CARB_G: 20,
      FAT_G: 6,
    });
    expect(output.items[1]!.nutrition!.values.ENERGY_KCAL).toBe(100);
    expect(output.questions).toEqual([]);
    expect(raw.changes).toEqual(['Filled the portion of Pizza']);
  });
});

describe('through the adapter', () => {
  it('imports a menu plan in one call', async () => {
    const result = await interpretPlan({
      sourceText: 'صبحانه: ۲ تخم‌مرغ\nناهار: مرغ و برنج',
      profile,
      deadlineAt: Date.now() + 10_000,
      userTag: 't',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.structure).toBe('SAME_EVERY_DAY');
    expect(result.data.slots).toHaveLength(5);
    expect(result.usage.promptTokens).toBe(1200);
  });

  it('imports a weekday plan chunk by chunk', async () => {
    const days = ['شنبه', 'یکشنبه', 'دوشنبه'];
    const result = await interpretPlan({
      sourceText: days.map((d) => `${d}\nصبحانه: تخم‌مرغ`).join('\n'),
      profile,
      deadlineAt: Date.now() + 10_000,
      userTag: 't',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.structure).toBe('BY_WEEKDAY');
    expect(result.data.slots.map((s) => s.weekday)).toEqual([6, 6, 6, 0, 0, 0, 1, 1, 1]);
    expect(result.attempts).toHaveLength(3);
  });

  it('estimates a baseline for every requested index', async () => {
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
        {
          index: 3,
          originalName: 'سالاد',
          englishLabel: 'Salad',
          quantity: null,
          unit: null,
          preparationNote: null,
          category: 'VEGETABLE',
        },
      ],
      deadlineAt: Date.now() + 10_000,
      userTag: 't',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((i) => [i.index, i.nutrition === null])).toEqual([
      [0, false],
      [3, true],
    ]);
  });

  it('analyses a meal and resolves the slot suggestion against the plan context', async () => {
    const result = await analyzeMeal({
      text: '۲ تخم‌مرغ، ۸۰ گرم نان سنگک',
      images: [],
      planContext: {
        slots: [
          {
            originalName: 'صبحانه',
            englishLabel: 'Breakfast',
            options: [{ label: null, items: [{ originalName: 'تخم‌مرغ', englishLabel: 'Egg' }] }],
          },
        ],
      },
      deadlineAt: Date.now() + 10_000,
      userTag: 't',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ englishLabel: 'Egg', quantity: 2 });
    expect(result.data.suggestedSlot).toEqual({
      originalName: 'صبحانه',
      englishLabel: 'Breakfast',
    });
    expect(result.data.suggestedOptionIndex).toBe(0);
  });

  it('generates a reflection that passes checkReflection', async () => {
    const facts = reflectionFacts(null, [], null, {
      greetingName: 'Sara',
      timeOfDay: 'EVENING',
      hasPlan: false,
      isFirstDay: true,
    });
    const input: GenerateReflectionInput = {
      facts,
      profile,
      greetingName: 'Sara',
      timeOfDay: 'EVENING',
      recentParagraphs: [],
      deadlineAt: Date.now() + 10_000,
      userTag: 't',
    };
    const result = await generateReflection(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.paragraph.startsWith('Good evening, Sara.')).toBe(true);
    expect(result.data.usedFactIds).toEqual(facts.slice(0, 3).map((f) => f.id));
    expect(
      checkReflection(
        reflectionOutputSchema.parse(stub.reflection(reflectionUserMessage(input))),
        facts,
      ),
    ).toBeNull();
  });

  it('honours the failure scenarios', async () => {
    const run = (text: string) =>
      analyzeMeal({
        text,
        images: [],
        planContext: null,
        deadlineAt: Date.now() + 5_000,
        userTag: 't',
      });
    expect(await run('eggs FAIL')).toMatchObject({ ok: false, reason: 'PROVIDER_ERROR' });
    expect(await run('eggs rate')).toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
    expect(await run('eggs EMPTY')).toMatchObject({ ok: false, reason: 'INVALID_JSON' });
    expect(await run('eggs invalid')).toMatchObject({ ok: false, reason: 'INVALID_JSON' });
    const slow = await analyzeMeal({
      text: 'eggs SLOW',
      images: [],
      planContext: null,
      deadlineAt: Date.now() + 200,
      userTag: 't',
    });
    expect(slow).toMatchObject({ ok: false, reason: 'TIMEOUT' });
  });

  it('answers /health', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
  });
});
