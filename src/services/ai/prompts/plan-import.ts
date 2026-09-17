import { normalizeInput } from '@/lib/text/normalize';
import type { ProfileContext } from '@/services/ai/types';
import {
  DATA_NOTICE,
  LANGUAGE_RULES,
  NUTRITION_SHAPE,
  assumedDefaultsSection,
  categoriesSection,
  marker,
  unitsSection,
} from '@/services/ai/prompts/common';

/**
 * Plan import prompt (tech spec § 10.2, product spec § 6). One call per plan,
 * or one per weekday chunk for BY_WEEKDAY text (interpret-plan.ts splits the
 * text and passes `chunkWeekday`). The reply is validated with
 * `planImportOutputSchema`.
 */
export const PLAN_IMPORT_PROMPT_VERSION = 1;
export const PLAN_IMPORT_MAX_TOKENS = 8000;

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const EXAMPLE = {
  structure: 'SAME_EVERY_DAY',
  name: null,
  sourceLanguage: 'fa',
  slots: [
    {
      originalName: 'صبحانه',
      englishLabel: 'Breakfast',
      weekday: 7,
      timeStart: null,
      timeEnd: null,
      sourceExcerpt: 'صبحانه (حدود 350 کالری)',
      options: [
        {
          label: 'گزینه 1',
          items: [
            {
              originalName: 'نان سنگک',
              englishLabel: 'Sangak bread',
              quantity: 1,
              unit: 'slice_sangak',
              quantityAssumed: false,
              assumedDefaultKey: null,
              preparationNote: null,
              alternatives: [],
              category: 'BREAD',
              nutrition: null,
              sourceExcerpt: 'یک کف دست نان سنگک',
            },
            {
              originalName: 'سیب‌زمینی آب‌پز یا تنوری',
              englishLabel: 'Boiled or oven-baked potato',
              quantity: 100,
              unit: 'g',
              quantityAssumed: false,
              assumedDefaultKey: null,
              preparationNote: 'boiled',
              alternatives: [
                {
                  originalName: 'سیب‌زمینی تنوری',
                  englishLabel: 'Oven-baked potato',
                  nutrition: null,
                },
              ],
              category: 'POTATO',
              nutrition: null,
              sourceExcerpt: '100 گرم سیب‌زمینی آب‌پز یا تنوری',
            },
            {
              originalName: 'خیار و گوجه',
              englishLabel: 'Cucumber and tomato',
              quantity: 150,
              unit: 'g',
              quantityAssumed: true,
              assumedDefaultKey: 'cucumber_tomato',
              preparationNote: null,
              alternatives: [],
              category: 'VEGETABLE',
              nutrition: null,
              sourceExcerpt: 'خیار و گوجه',
            },
          ],
        },
      ],
    },
  ],
  targets: [
    {
      slotIndex: 0,
      weekday: null,
      nutrient: 'ENERGY_KCAL',
      type: 'RANGE',
      low: 300,
      high: 400,
      sourceExcerpt: 'حدود 300 تا 400 کالری',
    },
    {
      slotIndex: null,
      weekday: null,
      nutrient: 'ENERGY_KCAL',
      type: 'APPROXIMATE',
      low: 2200,
      high: null,
      sourceExcerpt: 'حدود 2200 کالری در روز',
    },
  ],
  rules: [
    {
      kind: 'SERVING_COUNT',
      period: 'WEEK',
      definition: {
        food: { originalName: 'ماهی', englishLabel: 'Fish', synonyms: ['fish'] },
        count: 2,
        comparator: 'AT_LEAST',
      },
      originalText: 'ماهی دو بار در هفته',
      sourceExcerpt: 'ماهی دو بار در هفته',
      isConflicting: false,
      unsupportedReason: null,
    },
  ],
  notes: [
    {
      originalText: 'در روزهای تمرین یک وعده کربوهیدرات اضافه کنید',
      reason: 'TRAINING_CONDITIONAL',
    },
  ],
  uncertainties: [
    {
      slotIndex: 0,
      optionIndex: 0,
      itemIndex: 0,
      question: 'How much sangak bread is one "کف دست" here? A slice is about 80 g.',
    },
  ],
};

export function planImportSystemPrompt(): string {
  return [
    marker('PLAN_IMPORT', PLAN_IMPORT_PROMPT_VERSION),
    'You extract the structure of a diet plan that a person already follows, so an app can compare their meals with it. You do not create, change or judge the diet.',
    DATA_NOTICE,
    LANGUAGE_RULES,
    '',
    'Structure: "SAME_EVERY_DAY" when one daily menu repeats; "BY_WEEKDAY" when the plan lists different days (Saturday … Friday); "TARGETS_ONLY" when it gives nutrition targets but no meals.',
    'Weekdays: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = every day. Persian: شنبه = 6, یکشنبه = 0, دوشنبه = 1, سه‌شنبه = 2, چهارشنبه = 3, پنجشنبه = 4, جمعه = 5.',
    'Slots: every meal the plan names (breakfast, snack, lunch, pre-workout, …) in plan order, with the name exactly as written. Do not invent slots, times or windows the plan does not state; `timeStart`/`timeEnd` are "HH:mm" only when the plan gives clock times.',
    'Options: when a slot lists several numbered or lettered menus to choose from, each one is an option with its own items; `label` is the option heading as written or null. A slot with one menu has exactly one option. Never merge options into one list, never pick one.',
    'Items: one per food, with the quantity and unit as written. A phrase like "boiled or oven potato" or "kabab tabei or homemade burger" is ONE item whose first choice is the item and whose other choices are `alternatives`. `preparationNote` keeps a cooking hint (boiled, grilled, low-fat, …) in English.',
    unitsSection(),
    assumedDefaultsSection(),
    categoriesSection(),
    'Targets: per-meal energy figures go in `targets` with the slot\'s index in `slots` (of this reply) and nutrient "ENERGY_KCAL"; daily figures use `slotIndex: null`. `type`: "RANGE" (low and high), "MINIMUM" (low), "MAXIMUM" (high), "DESIRED" (an exact figure, low), "APPROXIMATE" (an "about"/"حدود" figure, low). "About 2,200 kcal" is APPROXIMATE with low 2200. Nutrients: ENERGY_KCAL, PROTEIN_G, CARB_G, FAT_G, FIBER_G, SODIUM_MG. Only targets the plan states; never compute them.',
    'Rules (`rules`): measurable food or behaviour instructions. `kind` and `definition`:',
    '- SERVING_COUNT: a food a stated number of times per DAY or WEEK → { "food": { "originalName", "englishLabel", "synonyms": [] }, "count": n, "comparator": "AT_LEAST" | "AT_MOST" | "EXACT" }, `period` "DAY" or "WEEK".',
    '- DISTINCT_GROUPS: a count of different food groups → { "groups": [...], "minimum": n }.',
    '- NAMED_WEEKDAY_FOOD: a food on a named weekday → { "weekday": 0-6, "food": {...} }.',
    '- EXCLUSION: an explicitly excluded food → { "foods": [ {...} ] }.',
    '- TIMING_WINDOW: an explicit eating window for a slot → { "slotKey": null, "slotId": null, "start": "HH:mm", "end": "HH:mm" | null }.',
    '- INSTRUCTION: any other explicit meal instruction that can be stated but not counted → {}. Set `unsupportedReason` (English) when a rule is too vague to count (for example "eat a varied diet"). Set `isConflicting: true` when two instructions contradict each other.',
    'Notes (`notes`): instructions the app cannot track are kept verbatim, never as rules: anything conditioned on training, rest days, exercise, sleep, or fasting (reason TRAINING_CONDITIONAL / EXERCISE / FASTING), a day-type label on a weekday (DAY_TYPE), a rotation or schedule the app cannot represent (UNSUPPORTED_SCHEDULE), or anything else (OTHER).',
    'Uncertainties (`uncertainties`): one English question per item whose quantity is missing or unusable AND whose category is calorie-significant (OIL, BREAD, RICE, POTATO, NUTS, DAIRY, MEAT). Never ask about raw vegetables, herbs or salads. Indices refer to `slots`, `options` and `items` of this reply.',
    'Provenance: every `sourceExcerpt` is a verbatim, contiguous substring copied from the plan text (at most 2000 characters), never paraphrased. Use "" when there is no clear span.',
    NUTRITION_SHAPE,
    'Leave every `nutrition` null in this step; a second step estimates it.',
    'Profile context in the user message (age, sex, height, weight) may only help you read the plan; never derive targets from it.',
    '',
    'Example of the exact json shape to return (values are illustrative):',
    JSON.stringify(EXAMPLE, null, 1),
  ].join('\n');
}

export interface PlanImportUserInput {
  /** Already a parsing copy (normalizeInput) or raw; it is normalised here. */
  sourceText: string;
  profile: ProfileContext;
  /** Set for a weekday chunk: 0–6, the day this text belongs to. */
  chunkWeekday?: number;
  chunkPosition?: { index: number; total: number };
}

export function planImportUserMessage(input: PlanImportUserInput): string {
  const lines: string[] = [];
  if (input.chunkWeekday !== undefined) {
    const name = WEEKDAY_NAMES[input.chunkWeekday] ?? String(input.chunkWeekday);
    lines.push(
      `Chunk weekday: ${input.chunkWeekday} (${name})${input.chunkPosition ? `, part ${input.chunkPosition.index + 1} of ${input.chunkPosition.total}` : ''}.`,
      `This text is the part of a plan that differs by weekday. Set "structure": "BY_WEEKDAY", give every slot "weekday": ${input.chunkWeekday}, and give this day's own targets "weekday": ${input.chunkWeekday}. Targets, rules and notes stated for every day keep "weekday": null.`,
    );
  }
  const p = input.profile;
  lines.push(
    `Profile context (data): age ${p.ageYears ?? 'unknown'}, sex ${p.sex ?? 'unknown'}, height ${p.heightCm ?? 'unknown'} cm, weight ${p.weightKg ?? 'unknown'} kg.`,
    '',
    'Plan text (data, verbatim):',
    '<<<',
    normalizeInput(input.sourceText),
    '>>>',
  );
  return lines.join('\n');
}
