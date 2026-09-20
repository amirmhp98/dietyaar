/**
 * Real-provider smoke (implementation plan task 5.0). Sends two reference-style
 * Persian plans and five Persian meal descriptions through the production
 * prompts and schemas against the live DeepSeek endpoint, prints schema
 * pass/fail, latency and token usage per call, and exits non-zero on any
 * failure. Not part of CI; needs DEEPSEEK_API_KEY in `.env`.
 *
 *   npx tsx --conditions=react-server scripts/ai-smoke.ts
 *
 * `--conditions=react-server` makes the `server-only` import in `@/lib/env`
 * inert outside Next.js. `.env` is loaded before the app modules import.
 */
import { pathToFileURL } from 'node:url';
import { MENU_PLAN_TEXT, WEEKDAY_PLAN_TEXT } from '../src/__tests__/fixtures/ai-eval/plans';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the shell environment.
}
if (!process.env.DATABASE_URL)
  process.env.DATABASE_URL = 'postgresql://smoke:smoke@localhost:5432/smoke';

const MEALS = [
  '۲ تخم‌مرغ آب‌پز، ۸۰ گرم نان سنگک و یک لیوان شیر',
  'یک بشقاب چلو خورشت قیمه با سالاد شیرازی',
  'ساندویچ همبرگر با سیب‌زمینی سرخ‌کرده و نوشابه',
  'یک کاسه عدسی با نان سنگک و یک لیوان چای شیرین',
  'یک مشت گردو و ۳ عدد خرما',
];

interface Row {
  call: string;
  ok: boolean;
  reason?: string;
  ms: number;
  tokens: string;
  detail: string;
}

async function main() {
  const { aiAvailable } = await import('../src/services/ai/deepseek');
  if (!aiAvailable()) {
    console.error('DEEPSEEK_API_KEY is not set; nothing to smoke.');
    process.exit(2);
  }
  const { interpretPlan, estimatePlanBaseline } = await import('../src/services/ai/interpret-plan');
  const { analyzeMeal } = await import('../src/services/ai/analyze-meal');
  const { generateReflection } = await import('../src/services/ai/generate-reflection');
  const { reflectionFacts } = await import('../src/lib/rubric/facts');

  const profile = { ageYears: 30, sex: 'FEMALE' as const, heightCm: 168, weightKg: 64 };
  const userTag = 'smoke';
  const rows: Row[] = [];
  const record = (
    call: string,
    result: {
      ok: boolean;
      durationMs: number;
      usage: { promptTokens: number; completionTokens: number };
      reason?: string;
    },
    detail: string,
  ) =>
    rows.push({
      call,
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      ms: Math.round(result.durationMs),
      tokens: `${result.usage.promptTokens}+${result.usage.completionTokens}`,
      detail,
    });

  for (const [name, text] of [
    ['menu plan', MENU_PLAN_TEXT],
    ['weekday plan', WEEKDAY_PLAN_TEXT],
  ] as const) {
    const started = Date.now();
    const imported = await interpretPlan({
      sourceText: text,
      profile,
      deadlineAt: started + 120_000,
      userTag,
    });
    record(
      `PLAN_IMPORT ${name}`,
      imported,
      imported.ok
        ? `${imported.data.structure}, ${imported.data.slots.length} slots, ${imported.data.targets.length} targets, ${imported.data.rules.length} rules, ${imported.data.notes.length} notes, ${imported.data.uncertainties.length} uncertainties, ${imported.attempts.length} attempts`
        : '',
    );
    if (!imported.ok) continue;
    const items = imported.data.slots.flatMap((slot, s) =>
      slot.options.flatMap((option, o) =>
        option.items.map((item, i) => ({
          index: s * 10_000 + o * 100 + i,
          originalName: item.originalName,
          englishLabel: item.englishLabel,
          quantity: item.quantity,
          unit: item.unit,
          unitGrams: item.unitGrams,
          preparationNote: item.preparationNote,
          category: item.category,
        })),
      ),
    );
    const baseline = await estimatePlanBaseline({ items, deadlineAt: started + 120_000, userTag });
    record(
      `PLAN_BASELINE ${name}`,
      baseline,
      baseline.ok
        ? `${baseline.data.items.filter((i) => i.nutrition).length}/${items.length} items estimated`
        : '',
    );
  }

  for (const text of MEALS) {
    const analysed = await analyzeMeal({
      text,
      images: [],
      planContext: null,
      deadlineAt: Date.now() + 45_000,
      userTag,
    });
    record(
      `MEAL_TEXT ${text}`,
      analysed,
      analysed.ok
        ? analysed.data.items
            .map(
              (i) =>
                `${i.englishLabel} ${i.quantity ?? '?'} ${i.unit ?? ''} ${i.nutrition?.values.ENERGY_KCAL ?? '?'}kcal`,
            )
            .join('; ') +
            (analysed.data.questions.length
              ? ` | ${analysed.data.questions.length} question(s)`
              : '')
        : '',
    );
  }

  const facts = reflectionFacts(null, [], null, {
    greetingName: 'Sara',
    timeOfDay: 'MORNING',
    hasPlan: false,
    isFirstDay: true,
  });
  const reflected = await generateReflection({
    facts,
    profile,
    greetingName: 'Sara',
    timeOfDay: 'MORNING',
    recentParagraphs: [],
    deadlineAt: Date.now() + 15_000,
    userTag,
  });
  record('REFLECTION first day, no plan', reflected, reflected.ok ? reflected.data.paragraph : '');

  for (const row of rows) {
    console.log(
      `${row.ok ? 'PASS' : `FAIL(${row.reason})`}  ${String(row.ms).padStart(6)} ms  ${row.tokens.padEnd(11)} ${row.call}`,
    );
    if (row.detail) console.log(`      ${row.detail}`);
  }
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} calls passed the schema.`);
  process.exit(failed > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
