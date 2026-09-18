/**
 * Evaluation harness (tech spec § 10.5, implementation plan task 11.5). Runs
 * the fixture set — both reference plans, 40 Persian meal descriptions and
 * every reflection state — against the live provider and reports schema pass
 * rate, expected-item recall, unit resolution rate, unsupported-fact rate,
 * p50 / p75 / p95 latency and token cost, next to the release thresholds of
 * tech spec § 19 item 4. Not part of CI; needs DEEPSEEK_API_KEY in `.env`.
 *
 *   npm run ai:eval            (= npx tsx --conditions=react-server scripts/ai-eval.ts)
 *   npm run ai:eval -- --meals-only
 *
 * Recall is reported for all meals and for the reviewed subset; the
 * thresholds are read only from reviewed rows (`reviewed: true` in
 * src/__tests__/fixtures/ai-eval/meals.ts), so until the owner reviews the
 * expected items the reviewed line stays empty.
 */
import { pathToFileURL } from 'node:url';
import { EVAL_MEALS } from '../src/__tests__/fixtures/ai-eval/meals';
import { MENU_PLAN_TEXT, WEEKDAY_PLAN_TEXT } from '../src/__tests__/fixtures/ai-eval/plans';
import { unitByKey } from '../src/lib/units';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the shell environment.
}
if (!process.env.DATABASE_URL)
  process.env.DATABASE_URL = 'postgresql://eval:eval@localhost:5432/eval';

/** List prices per million tokens; override when the provider changes them. */
const PRICE_IN_PER_M = Number(process.env.AI_EVAL_PRICE_IN_PER_M ?? '0.27');
const PRICE_OUT_PER_M = Number(process.env.AI_EVAL_PRICE_OUT_PER_M ?? '1.10');
const CONCURRENCY = Number(process.env.AI_EVAL_CONCURRENCY ?? '4');

const THRESHOLDS = {
  schemaPass: 0.98,
  recall: 0.85,
  unitResolution: 0.9,
  unsupportedFacts: 0.02,
  p75Ms: 15_000,
};

interface CallStat {
  kind: string;
  ok: boolean;
  reason?: string;
  ms: number;
  promptTokens: number;
  completionTokens: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

function mark(pass: boolean | null): string {
  return pass === null ? '   ' : pass ? 'OK ' : 'LOW';
}

const NUMBER = /\d+(?:[.,]\d+)?/g;

/** Latin and Persian digits found in a text, normalised to Latin. */
function numbersIn(text: string): Set<string> {
  const latin = text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  return new Set((latin.match(NUMBER) ?? []).map((n) => n.replace(',', '.')));
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const mealsOnly = process.argv.includes('--meals-only');
  const { aiAvailable } = await import('../src/services/ai/deepseek');
  if (!aiAvailable()) {
    console.error('DEEPSEEK_API_KEY is not set; nothing to evaluate.');
    process.exit(2);
  }
  const { interpretPlan, estimatePlanBaseline } = await import('../src/services/ai/interpret-plan');
  const { analyzeMeal } = await import('../src/services/ai/analyze-meal');
  const { generateReflection } = await import('../src/services/ai/generate-reflection');
  const { buildEvalReflections } = await import('../src/__tests__/fixtures/ai-eval/reflections');

  const profile = { ageYears: 30, sex: 'FEMALE' as const, heightCm: 168, weightKg: 64 };
  const userTag = 'eval';
  const stats: CallStat[] = [];
  const record = (
    kind: string,
    result: {
      ok: boolean;
      durationMs: number;
      usage: { promptTokens: number; completionTokens: number };
      reason?: string;
    },
  ) =>
    stats.push({
      kind,
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      ms: Math.round(result.durationMs),
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    });

  // ── Plans ──────────────────────────────────────────────────────────────
  if (!mealsOnly) {
    for (const [name, text] of [
      ['menu', MENU_PLAN_TEXT],
      ['weekday', WEEKDAY_PLAN_TEXT],
    ] as const) {
      const started = Date.now();
      const imported = await interpretPlan({
        sourceText: text,
        profile,
        deadlineAt: started + 120_000,
        userTag,
      });
      record(`PLAN_IMPORT ${name}`, imported);
      if (!imported.ok) {
        console.log(`PLAN_IMPORT ${name}: FAIL (${imported.reason})`);
        continue;
      }
      console.log(
        `PLAN_IMPORT ${name}: ${imported.data.structure}, ${imported.data.slots.length} slots, ${imported.data.rules.length} rules, ${Math.round(imported.durationMs)} ms`,
      );
      const items = imported.data.slots.flatMap((slot, s) =>
        slot.options.flatMap((option, o) =>
          option.items.map((item, i) => ({
            index: s * 10_000 + o * 100 + i,
            originalName: item.originalName,
            englishLabel: item.englishLabel,
            quantity: item.quantity,
            unit: item.unit,
            preparationNote: item.preparationNote,
            category: item.category,
          })),
        ),
      );
      const baseline = await estimatePlanBaseline({
        items,
        deadlineAt: Date.now() + 120_000,
        userTag,
      });
      record(`PLAN_BASELINE ${name}`, baseline);
      console.log(
        `PLAN_BASELINE ${name}: ${baseline.ok ? `${baseline.data.items.filter((i) => i.nutrition).length}/${items.length} estimated` : `FAIL (${baseline.reason})`}, ${Math.round(baseline.durationMs)} ms`,
      );
    }
  }

  // ── Meals ──────────────────────────────────────────────────────────────
  let expectedTotal = 0;
  let recalledTotal = 0;
  let expectedReviewed = 0;
  let recalledReviewed = 0;
  let itemsTotal = 0;
  let itemsWithUnit = 0;
  const mealLatencies: number[] = [];
  const mealRows = await mapLimit(EVAL_MEALS, CONCURRENCY, async (meal) => {
    const analysed = await analyzeMeal({
      text: meal.text,
      images: [],
      planContext: null,
      deadlineAt: Date.now() + 45_000,
      userTag,
    });
    return { meal, analysed };
  });
  for (const { meal, analysed } of mealRows) {
    record('MEAL_TEXT', analysed);
    mealLatencies.push(Math.round(analysed.durationMs));
    if (!analysed.ok) {
      console.log(`MEAL FAIL (${analysed.reason}): ${meal.text}`);
      continue;
    }
    const labels = analysed.data.items.map((i) => i.englishLabel.toLowerCase());
    const missing = meal.expectedItems.filter(
      (keyword) => !keyword.split('|').some((k) => labels.some((l) => l.includes(k))),
    );
    const recalled = meal.expectedItems.length - missing.length;
    expectedTotal += meal.expectedItems.length;
    recalledTotal += recalled;
    if (meal.reviewed) {
      expectedReviewed += meal.expectedItems.length;
      recalledReviewed += recalled;
    }
    // Unit resolution counts items that carry a quantity; a free-text unit the
    // model could not map to the unit table counts as unresolved.
    const quantified = analysed.data.items.filter((i) => i.quantity !== null);
    itemsTotal += quantified.length;
    itemsWithUnit += quantified.filter((i) => unitByKey(i.unit) !== undefined).length;
    console.log(
      `MEAL ${recalled}/${meal.expectedItems.length} ${String(Math.round(analysed.durationMs)).padStart(6)} ms  ${meal.text}` +
        (missing.length ? `  (missing: ${missing.join(', ')})` : '') +
        `\n      ${analysed.data.items.map((i) => `${i.englishLabel} ${i.quantity ?? '?'} ${i.unit ?? '—'}${i.unit && !unitByKey(i.unit) ? '(!)' : ''}`).join('; ')}`,
    );
  }

  // ── Reflections ────────────────────────────────────────────────────────
  let reflections = 0;
  let unsupported = 0;
  let expectedFactsUsed = 0;
  if (!mealsOnly) {
    for (const state of buildEvalReflections()) {
      const reflected = await generateReflection({
        facts: state.facts,
        profile,
        greetingName: state.context.greetingName,
        timeOfDay: state.context.timeOfDay,
        recentParagraphs: [],
        deadlineAt: Date.now() + 15_000,
        userTag,
      });
      record(`REFLECTION ${state.name}`, reflected);
      if (!reflected.ok) {
        console.log(`REFLECTION FAIL (${reflected.reason}): ${state.name}`);
        continue;
      }
      reflections += 1;
      const factIds = new Set(state.facts.map((f) => f.id));
      const factNumbers = new Set<string>();
      for (const f of state.facts) for (const n of numbersIn(f.text)) factNumbers.add(n);
      const unknownIds = reflected.data.usedFactIds.filter((id) => !factIds.has(id));
      const unknownNumbers = [...numbersIn(reflected.data.paragraph)].filter(
        (n) => !factNumbers.has(n),
      );
      const problems = [
        ...unknownIds.map((id) => `fact ${id}`),
        ...unknownNumbers.map((n) => `number ${n}`),
      ];
      if (problems.length) unsupported += 1;
      const usedExpected = state.expectedFactIds.some((prefix) =>
        reflected.data.usedFactIds.some((id) => id.startsWith(prefix)),
      );
      if (usedExpected) expectedFactsUsed += 1;
      console.log(
        `REFLECTION ${state.name}: ${problems.length ? `unsupported ${problems.join(', ')}` : 'supported'}; ${usedExpected ? 'uses expected facts' : `expected facts ${state.expectedFactIds.join('/')} not used`}; ${Math.round(reflected.durationMs)} ms\n      ${reflected.data.paragraph}`,
      );
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const passed = stats.filter((s) => s.ok).length;
  const promptTokens = stats.reduce((a, s) => a + s.promptTokens, 0);
  const completionTokens = stats.reduce((a, s) => a + s.completionTokens, 0);
  const cost = (promptTokens * PRICE_IN_PER_M + completionTokens * PRICE_OUT_PER_M) / 1_000_000;
  const schemaRate = stats.length ? passed / stats.length : 0;
  const recallReviewed = expectedReviewed ? recalledReviewed / expectedReviewed : null;
  const unitRate = itemsTotal ? itemsWithUnit / itemsTotal : 0;
  const unsupportedRate = reflections ? unsupported / reflections : null;
  const p50 = percentile(mealLatencies, 50);
  const p75 = percentile(mealLatencies, 75);
  const p95 = percentile(mealLatencies, 95);

  console.log('\n── Summary ───────────────────────────────────────────────');
  console.log(
    `${mark(schemaRate >= THRESHOLDS.schemaPass)} schema pass         ${pct(passed, stats.length)} (${passed}/${stats.length}; threshold ${THRESHOLDS.schemaPass * 100}%)`,
  );
  console.log(
    `${mark(null)} item recall (all)   ${pct(recalledTotal, expectedTotal)} over ${EVAL_MEALS.length} meals, ${EVAL_MEALS.filter((m) => m.reviewed).length} reviewed`,
  );
  console.log(
    `${mark(recallReviewed === null ? null : recallReviewed >= THRESHOLDS.recall)} item recall (rev.)  ${recallReviewed === null ? 'no reviewed meals yet — review src/__tests__/fixtures/ai-eval/meals.ts' : `${pct(recalledReviewed, expectedReviewed)} (threshold ${THRESHOLDS.recall * 100}%)`}`,
  );
  console.log(
    `${mark(unitRate >= THRESHOLDS.unitResolution)} unit resolution     ${pct(itemsWithUnit, itemsTotal)} (threshold ${THRESHOLDS.unitResolution * 100}%)`,
  );
  console.log(
    `${mark(unsupportedRate === null ? null : unsupportedRate <= THRESHOLDS.unsupportedFacts)} unsupported facts   ${unsupportedRate === null ? 'n/a' : `${pct(unsupported, reflections)} (${expectedFactsUsed}/${reflections} used the expected facts; threshold ≤ ${THRESHOLDS.unsupportedFacts * 100}%)`}`,
  );
  console.log(
    `${mark(p75 <= THRESHOLDS.p75Ms)} meal latency        p50 ${p50} ms · p75 ${p75} ms · p95 ${p95} ms (threshold p75 ≤ ${THRESHOLDS.p75Ms} ms)`,
  );
  console.log(
    `    tokens              ${promptTokens} in + ${completionTokens} out ≈ $${cost.toFixed(4)} at $${PRICE_IN_PER_M}/$${PRICE_OUT_PER_M} per M`,
  );
  const failures = stats.filter((s) => !s.ok);
  if (failures.length)
    console.log(
      `    failures            ${failures.map((f) => `${f.kind} (${f.reason})`).join('; ')}`,
    );
  process.exit(schemaRate >= THRESHOLDS.schemaPass ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
