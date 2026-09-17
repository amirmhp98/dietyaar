#!/usr/bin/env node
/**
 * Deterministic stub of the DeepSeek chat-completions endpoint for Playwright
 * (implementation plan task 5.5). Plain `http`, no dependencies, Node >= 22.
 *
 *   node e2e/stub-ai/server.mjs --port 3999
 *
 * Kind: read from the marker every system prompt starts with,
 * `# dietyaar:<KIND> v<n>` (src/services/ai/prompts/common.ts).
 *
 * Scenario: header `x-stub-scenario`, or a case-insensitive token in the user
 * text: SLOW (20 s delay), FAIL (HTTP 500), EMPTY (empty content), RATE (429),
 * INVALID (non-JSON content), WEEKDAY (a Saturday–Friday plan). A plan chunk
 * whose user message says `Chunk weekday: N` answers with that day's slots.
 *
 * GET /health → 200.
 */
import http from 'node:http';

const port = Number(process.argv[process.argv.indexOf('--port') + 1] || 3999);
const SLOW_MS = 20_000;
const SCENARIOS = ['SLOW', 'FAIL', 'EMPTY', 'RATE', 'INVALID', 'WEEKDAY'];

// ─── Helpers ────────────────────────────────────────────────────────────────

const nutrition = (kcal, protein, carb, fat, quantity = null, unit = null) => ({
  basis: 'PER_RECORDED_PORTION',
  basisQuantity: quantity,
  basisUnit: unit,
  values: {
    ENERGY_KCAL: kcal,
    PROTEIN_G: protein,
    CARB_G: carb,
    FAT_G: fat,
    FIBER_G: null,
    SODIUM_MG: null,
  },
  source: 'AI_ESTIMATE',
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
});

const planItem = (originalName, englishLabel, quantity, unit, category, extra = {}) => ({
  originalName,
  englishLabel,
  quantity,
  unit,
  quantityAssumed: false,
  assumedDefaultKey: null,
  preparationNote: null,
  alternatives: [],
  category,
  nutrition: null,
  sourceExcerpt: '',
  ...extra,
});

const slot = (originalName, englishLabel, options, weekday = 7) => ({
  originalName,
  englishLabel,
  weekday,
  timeStart: null,
  timeEnd: null,
  sourceExcerpt: originalName,
  options,
});

const option = (label, items) => ({ label, items });

const range = (slotIndex, low, high, weekday = null) => ({
  slotIndex,
  weekday,
  nutrient: 'ENERGY_KCAL',
  type: 'RANGE',
  low,
  high,
  sourceExcerpt: null,
});

// ─── Canned plan outputs ────────────────────────────────────────────────────

/** Menu-style Persian plan: five slots, options per slot, ranges, one note, one rule. */
function menuPlan() {
  const slots = [
    slot('صبحانه', 'Breakfast', [
      option('گزینه 1', [
        planItem('تخم‌مرغ', 'Egg', 2, 'egg', 'MEAT'),
        planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
        planItem('خیار و گوجه', 'Cucumber and tomato', 150, 'g', 'VEGETABLE', {
          quantityAssumed: true,
          assumedDefaultKey: 'cucumber_tomato',
        }),
      ]),
      option('گزینه 2', [
        planItem('شیر کم‌چرب', 'Low-fat milk', 1, 'glass', 'DAIRY'),
        planItem('جو دوسر', 'Oats', 40, 'g', 'OTHER'),
        planItem('گردو', 'Walnuts', 3, 'walnut', 'NUTS'),
      ]),
      option('گزینه 3', [
        planItem('پنیر', 'Cheese', 30, 'g', 'DAIRY'),
        planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
        planItem('چای', 'Tea', 1, 'glass', 'OTHER'),
      ]),
    ]),
    slot('میان‌وعده اول', 'First snack', [
      option(null, [planItem('سیب', 'Apple', 1, 'medium_apple', 'FRUIT')]),
    ]),
    slot('ناهار', 'Lunch', [
      option('گزینه 1', [
        planItem('مرغ گریل', 'Grilled chicken', 150, 'g', 'MEAT'),
        planItem('برنج', 'Rice', 100, 'g', 'RICE'),
        planItem('سالاد بزرگ', 'Large salad', 200, 'g', 'VEGETABLE', {
          quantityAssumed: true,
          assumedDefaultKey: 'large_salad',
        }),
      ]),
      option('گزینه 2', [
        planItem('جوجه کباب', 'Joojeh kabab', 1, 'skewer_kabab', 'MEAT'),
        planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
      ]),
      option('گزینه 3', [
        planItem('عدسی', 'Adasi (lentil stew)', 1, 'bowl', 'OTHER'),
        planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
      ]),
      option('گزینه 4', [
        planItem('ماهی', 'Fish', 150, 'g', 'MEAT'),
        planItem('سیب‌زمینی آب‌پز یا تنوری', 'Boiled or oven-baked potato', 150, 'g', 'POTATO', {
          alternatives: [
            { originalName: 'سیب‌زمینی تنوری', englishLabel: 'Oven-baked potato', nutrition: null },
          ],
        }),
      ]),
    ]),
    slot('میان‌وعده دوم', 'Second snack', [
      option(null, [planItem('ماست', 'Yogurt', 150, 'g', 'DAIRY')]),
    ]),
    slot('شام', 'Dinner', [
      option('گزینه 1', [
        planItem('املت', 'Omelette', 2, 'egg', 'MEAT'),
        planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
      ]),
      option('گزینه 2', [
        planItem(
          'کباب تابه‌ای یا همبرگر خانگی',
          'Kabab tabei or homemade burger',
          120,
          'g',
          'MEAT',
          {
            alternatives: [
              { originalName: 'همبرگر خانگی', englishLabel: 'Homemade burger', nutrition: null },
            ],
          },
        ),
        planItem('سبزی خوردن', 'Fresh herbs', 30, 'g', 'HERB', {
          quantityAssumed: true,
          assumedDefaultKey: 'herbs',
        }),
      ]),
    ]),
  ];
  return {
    structure: 'SAME_EVERY_DAY',
    name: 'برنامه غذایی',
    sourceLanguage: 'fa',
    slots,
    targets: [
      range(0, 300, 400),
      range(1, 100, 150),
      range(2, 600, 700),
      range(3, 100, 150),
      range(4, 400, 500),
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
        optionIndex: 2,
        itemIndex: 0,
        question: 'How much cheese is one portion here?',
      },
    ],
  };
}

const WEEKDAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const DAY_TYPES = ['rest', 'training', 'rest', 'training', 'rest', 'rest', 'training'];

/** One weekday's three slots, with an alternative in the dinner item. */
function weekdaySlots(weekday) {
  const preWorkout = DAY_TYPES[weekday] === 'training';
  return [
    slot(
      'صبحانه',
      'Breakfast',
      [
        option(null, [
          planItem('تخم‌مرغ', 'Egg', 2, 'egg', 'MEAT'),
          planItem('نان سنگک', 'Sangak bread', 1, 'slice_sangak', 'BREAD'),
        ]),
      ],
      weekday,
    ),
    slot(
      preWorkout ? 'قبل تمرین' : 'میان‌وعده عصر',
      preWorkout ? 'Pre-workout' : 'Afternoon snack',
      [option(null, [planItem('موز', 'Banana', 1, 'small_banana', 'FRUIT')])],
      weekday,
    ),
    slot(
      'شام',
      'Dinner',
      [
        option(null, [
          planItem(
            'کباب تابه‌ای یا همبرگر خانگی',
            'Kabab tabei or homemade burger',
            120,
            'g',
            'MEAT',
            {
              alternatives: [
                { originalName: 'همبرگر خانگی', englishLabel: 'Homemade burger', nutrition: null },
              ],
            },
          ),
          planItem('سیب‌زمینی آب‌پز یا تنوری', 'Boiled or oven-baked potato', 150, 'g', 'POTATO', {
            alternatives: [
              {
                originalName: 'سیب‌زمینی تنوری',
                englishLabel: 'Oven-baked potato',
                nutrition: null,
              },
            ],
          }),
        ]),
      ],
      weekday,
    ),
  ];
}

/** One chunk of a weekday plan (what interpret-plan.ts asks for per weekday). */
function weekdayChunk(weekday) {
  return {
    structure: 'BY_WEEKDAY',
    name: 'برنامه هفتگی',
    sourceLanguage: 'fa',
    slots: weekdaySlots(weekday),
    targets: [
      {
        slotIndex: null,
        weekday,
        nutrient: 'ENERGY_KCAL',
        type: 'APPROXIMATE',
        low: DAY_TYPES[weekday] === 'training' ? 2200 : 1900,
        high: null,
        sourceExcerpt: null,
      },
    ],
    rules: [],
    notes: [
      {
        originalText: `${WEEKDAY_NAMES[weekday]}: روز ${DAY_TYPES[weekday] === 'training' ? 'تمرین' : 'استراحت'}`,
        reason: 'DAY_TYPE',
      },
    ],
    uncertainties: [],
  };
}

/** The whole week in one reply (Saturday first), for text the app did not chunk. */
function weekdayPlan() {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const merged = { ...weekdayChunk(6), slots: [], targets: [], notes: [] };
  for (const weekday of order) {
    const chunk = weekdayChunk(weekday);
    merged.slots.push(...chunk.slots);
    merged.targets.push(...chunk.targets);
    merged.notes.push(...chunk.notes);
  }
  return merged;
}

// ─── Baseline ───────────────────────────────────────────────────────────────

function baseline(userText) {
  const start = userText.indexOf('[');
  const end = userText.lastIndexOf(']');
  let items = [];
  try {
    items = start >= 0 && end > start ? JSON.parse(userText.slice(start, end + 1)) : [];
  } catch {
    items = [];
  }
  return {
    items: items.map((item, i) => ({
      index: typeof item.index === 'number' ? item.index : i,
      nutrition:
        item.quantity === null || item.quantity === undefined
          ? null
          : nutrition(120 + (i % 5) * 40, 6, 12, 4, item.quantity, item.unit ?? null),
    })),
  };
}

// ─── Meal analysis ──────────────────────────────────────────────────────────

const FOODS = [
  {
    match: /تخم[\s‌]?مرغ|\beggs?\b/i,
    originalName: 'تخم‌مرغ',
    englishLabel: 'Egg',
    quantity: 2,
    unit: 'egg',
    category: 'MEAT',
    kcal: 155,
    p: 12.6,
    c: 1.1,
    f: 10.6,
  },
  {
    match: /نان سنگک|سنگک|\bsangak\b/i,
    originalName: 'نان سنگک',
    englishLabel: 'Sangak bread',
    quantity: 1,
    unit: 'slice_sangak',
    category: 'BREAD',
    kcal: 210,
    p: 7,
    c: 42,
    f: 1.5,
  },
  {
    match: /ماست|\byogh?urt\b/i,
    originalName: 'ماست',
    englishLabel: 'Yogurt',
    quantity: 150,
    unit: 'g',
    category: 'DAIRY',
    kcal: 95,
    p: 5,
    c: 7,
    f: 5,
  },
  {
    match: /برنج|پلو|\brice\b/i,
    originalName: 'برنج',
    englishLabel: 'Rice',
    quantity: 150,
    unit: 'g',
    category: 'RICE',
    kcal: 195,
    p: 4,
    c: 42,
    f: 0.5,
  },
  {
    match: /(?<!تخم[\s‌]?)مرغ|جوجه|\bchicken\b/iu,
    originalName: 'مرغ',
    englishLabel: 'Chicken',
    quantity: 150,
    unit: 'g',
    category: 'MEAT',
    kcal: 240,
    p: 40,
    c: 0,
    f: 8,
  },
  {
    match: /گردو|\bwalnuts?\b/i,
    originalName: 'گردو',
    englishLabel: 'Walnuts',
    quantity: 3,
    unit: 'walnut',
    category: 'NUTS',
    kcal: 78,
    p: 1.8,
    c: 1.6,
    f: 7.8,
  },
  {
    match: /همبرگر|\bburger\b/i,
    originalName: 'همبرگر',
    englishLabel: 'Burger',
    quantity: 1,
    unit: 'piece',
    category: 'MEAT',
    kcal: 450,
    p: 25,
    c: 35,
    f: 22,
  },
  {
    match: /ساندویچ|\bsandwich\b/i,
    originalName: 'ساندویچ',
    englishLabel: 'Sandwich',
    quantity: 1,
    unit: 'piece',
    category: 'BREAD',
    kcal: 380,
    p: 18,
    c: 40,
    f: 15,
  },
];

function mealAnalysis(userText) {
  const description = userText.split('<<<')[1]?.split('>>>')[0] ?? '';
  const items = [];
  for (const food of FOODS) {
    // A leading count, e.g. "2 تخم‌مرغ" or "3 eggs", overrides the default quantity.
    const counted = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(?:عدد|تا)?\\s*(?:${food.match.source})`,
      'iu',
    );
    const hit = counted.exec(description);
    if (!hit && !food.match.test(description)) continue;
    const quantity = hit ? Number(hit[1]) : food.quantity;
    const scale = quantity / food.quantity;
    items.push({
      originalName: food.originalName,
      englishLabel: food.englishLabel,
      quantity,
      unit: food.unit,
      quantityUnknown: false,
      quantityAssumed: !hit,
      preparation: null,
      category: food.category,
      alternatives: [],
      nutrition: nutrition(
        Math.round(food.kcal * scale),
        Math.round(food.p * scale * 10) / 10,
        Math.round(food.c * scale * 10) / 10,
        Math.round(food.f * scale * 10) / 10,
        quantity,
        food.unit,
      ),
    });
  }
  const questions = [];
  if (items.length === 0) {
    items.push({
      originalName: description.trim().slice(0, 200) || 'Unknown dish',
      englishLabel: 'Unidentified dish',
      quantity: null,
      unit: null,
      quantityUnknown: true,
      quantityAssumed: false,
      preparation: null,
      category: 'OTHER',
      alternatives: [],
      nutrition: null,
    });
    questions.push({
      itemIndex: 0,
      question: 'How much of this did you eat?',
      kind: 'PORTION',
      choices: ['a small portion', 'a medium portion', 'a large portion'],
    });
  }
  const suggestsBreakfast =
    items.some((i) => i.englishLabel === 'Egg' || i.englishLabel === 'Sangak bread') &&
    /صبحانه|Breakfast/.test(userText);
  return {
    items,
    suggestedSlot: suggestsBreakfast ? { originalName: 'صبحانه', englishLabel: 'Breakfast' } : null,
    suggestedOptionIndex: suggestsBreakfast ? 0 : null,
    questions,
  };
}

// ─── Reflection ─────────────────────────────────────────────────────────────

function reflection(userText) {
  const ids = Array.from(userText.matchAll(/^- \[([^\]]+)\]/gm), (m) => m[1]).slice(0, 3);
  const name = /^Greeting name: (.+)$/m.exec(userText)?.[1]?.trim() ?? 'there';
  const time = (/^Time of day: (\w+)$/m.exec(userText)?.[1] ?? 'MORNING').toLowerCase();
  // 60–80 words, no digits, no banned words.
  const paragraph =
    `Good ${time}, ${name}. This reflection covers the meals you recorded yesterday rather than a judgement of the whole day, ` +
    'and it stays close to what your plan actually lists. Where a meal matched the plan, that is a steady result worth noticing; ' +
    'where records were missing, nothing is assumed. For the rest of today, the next slot in your plan is a comfortable place to ' +
    'continue, adjusting portions to what you actually eat. One meal at a time is enough.';
  return { paragraph, usedFactIds: ids };
}

// ─── Request handling ───────────────────────────────────────────────────────

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content
      .filter((part) => part && part.type === 'text')
      .map((part) => part.text)
      .join('\n');
  return '';
}

function scenarioOf(req, userText) {
  const header = String(req.headers['x-stub-scenario'] ?? '').toUpperCase();
  if (SCENARIOS.includes(header)) return header;
  const match = new RegExp(`\\b(${SCENARIOS.join('|')})\\b`, 'i').exec(userText);
  return match ? match[1].toUpperCase() : null;
}

function cannedOutput(kind, userText, scenario) {
  switch (kind) {
    case 'PLAN_IMPORT': {
      const chunk = /^Chunk weekday: (\d)/m.exec(userText);
      if (chunk) return weekdayChunk(Number(chunk[1]));
      return scenario === 'WEEKDAY' ? weekdayPlan() : menuPlan();
    }
    case 'PLAN_BASELINE':
      return baseline(userText);
    case 'MEAL_TEXT':
    case 'MEAL_PHOTO':
      return mealAnalysis(userText);
    case 'REFLECTION':
      return reflection(userText);
    default:
      return {};
  }
}

function envelope(content, model = 'stub') {
  return JSON.stringify({
    id: 'stub',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1200, completion_tokens: 400, total_tokens: 1600 },
  });
}

function respond(req, res, body) {
  let parsed = {};
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end('{"error":"invalid request body"}');
    return;
  }
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const system = textOf(messages.find((m) => m.role === 'system')?.content);
  const userText = textOf(messages.find((m) => m.role === 'user')?.content);
  const kind = /^# dietyaar:([A-Z_]+)/m.exec(system)?.[1] ?? 'UNKNOWN';
  const scenario = scenarioOf(req, userText);
  const model = parsed.model || 'stub';

  const send = () => {
    if (res.destroyed) return;
    switch (scenario) {
      case 'FAIL':
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{"error":{"message":"stub failure"}}');
        return;
      case 'RATE':
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end('{"error":{"message":"rate limited"}}');
        return;
      case 'EMPTY':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(envelope('', model));
        return;
      case 'INVALID':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(envelope('this is not json {', model));
        return;
      default:
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(envelope(JSON.stringify(cannedOutput(kind, userText, scenario)), model));
    }
  };
  if (scenario === 'SLOW') {
    const timer = setTimeout(send, SLOW_MS);
    req.on('close', () => clearTimeout(timer));
  } else {
    send();
  }
}

export const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => respond(req, res, body));
});

export { cannedOutput, mealAnalysis, menuPlan, reflection, weekdayChunk, weekdayPlan };

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  server.listen(port, () => console.log(`stub-ai listening on ${port}`));
}
