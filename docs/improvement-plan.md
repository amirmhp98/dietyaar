# Dietyaar — Pre-launch improvement plan

**Date:** 2026-09-19 · **Build:** `main` at `b0c9c1b` · **Status:** proposed, awaiting owner approval
**Inputs:** `docs/reviews/2026-09-19-opus.md` (16 defects D1–D16, 10 ranked findings), `docs/reviews/2026-09-19-fable.md` (defects M1–M3, L1–L7, U1–U2, product recommendations 1–10, visual improvements 1–8), the owner's walkthrough feedback and answers of 2026-09-19, and the specs under `docs/`.

This plan is the single list of what changes before real users are invited. Every item names its source (**O** = Opus report, **F** = Fable report, **U** = owner), where it lands in the code, and how it is verified. § 7 maps every report finding and owner remark to a plan item or to an explicit "not doing" with the reason, so nothing is silently dropped.

---

## 0. Summary

**Where we are.** V1 is spec-complete and the quality gate is green (lint, 458 unit, 20 integration, 72 e2e, build). Both reviewers reached the same verdict independently: the comparison engine is honest and explainable, bidi text, dark mode and token discipline are done well; but the logging loop cannot finish what the AI starts, the composer leads with the wrong thing, and the pages read as a column of identical white cards with status carried by grey text. The owner's walkthrough adds: the app feels like a B2B tool, it is text-heavy, count units are modelled wrong, time zone is noise, and the reflection should not sit above the score every time.

**Five root causes** explain most of the findings (§ 1). Three of them are design decisions taken at planning time rather than bugs, which is why this plan changes specs and decision records, not only code.

**Five phases, each ending in a gate** (`npm run lint:all && npm run test && npm run test:integration && npm run build && npm run test:e2e` plus a phone walkthrough). The owner sets the calendar; sizes are given so the phases can be scheduled.

| Phase | Theme                                                                          | Size     |
| ----- | ------------------------------------------------------------------------------ | -------- |
| A     | Truth first: real AI locally, measure parse quality, tighten the prompt        | ~1 day   |
| B     | Logging-loop correctness: the P1/P2 defects, composer navigation, photo button | 4–5 days |
| C     | Owner product decisions: time zone, rules, units, windows, reflection, labels  | 4–5 days |
| D     | Visual re-skin toward B2C: design.md revision, surfaces, glyphs, icon actions  | 5–7 days |
| E     | Launch readiness: docs, tests, storage in CI, phone checklist                  | ~2 days  |

Phases A and B do not depend on C or D and can start immediately. C changes data (three migrations) and should land before D so the re-skin is done on the final information architecture.

---

## 1. Root causes

1. **Local development talks to the e2e stub, not DeepSeek.** `.env` sets `DEEPSEEK_API_BASE_URL=http://localhost:3999` (`e2e/stub-ai/server.mjs`), which recognises a fixed list of ~20 foods and ignores everything else. Every meal the owner logged locally was parsed by the stub. Both reviewers ran the live model and got full item recall on the reference-plan meals. The parse-quality complaint (U) must be re-measured against the real API before the prompt is touched (Phase A).
2. **`design.md` is a Supabase marketing token sheet.** Its stated character is "quietly technical, near-monochrome, one emerald event, product screenshots instead of illustrations, never pill-shaped", and decision 019 adopted it as-is. The token architecture is sound; the visual language it prescribes is the B2B feel the owner objects to (Phase D).
3. **The review step is a dead end for uncertainty.** Question answers are stored and never read (O D1); Re-estimate replaces every item with fresh output (O D2); a replaced meal cannot be saved without picking an option that was not eaten (O D3, F 1.3). These three alone make photo logging and any meal with a portion question unfinishable (Phase B).
4. **Units conflate size with measure.** `lib/units.ts` has `medium_apple`, `small_banana`, `medium_orange`, `egg`, `walnut` as unit keys, so quantity + unit reads "1 medium apple" and a pear has no unit at all (U). Count is a count; size belongs to the name; grams-per-piece is an attribute (Phase C).
5. **Status has no shape.** One card recipe for every block; recorded/not recorded/skipped/needs review are the same grey text; icons live on utility buttons, not on the surfaces the eye scans (O 2.2, F 2.1–2.3, U). Grouping is done by font size instead of surface and glyph (Phase D).

---

## 2. Owner decisions recorded 2026-09-19

These are binding for this plan; each becomes a decision record in Phase E.

| #   | Topic                    | Decision                                                                                                                                                                                                                    |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AI provider locally      | Connect local dev to the real DeepSeek API; the stub is for e2e only.                                                                                                                                                       |
| 2   | Time zone                | Fixed to `Asia/Dubai` for every account. Lowest cognitive load _and_ no dead code: the three UI surfaces and the device-zone hint feature are removed; the zone-aware date functions stay and read one constant.            |
| 3   | Meal time windows        | Every slot gets a window. Windows drive the Today CTAs only; they never enter the timing score. No new editing UI; the existing slot editor's time fields are enough. A not-yet-open slot may show a small, faint action.   |
| 4   | Reflection after reading | "Got it" moves the card to the bottom of Today for the rest of the day.                                                                                                                                                     |
| 5   | Empty-day reflection     | No AI call when yesterday has no records (also first day and no plan); use the deterministic paragraph, with warmer copy than today's.                                                                                      |
| 6   | Option labels            | Always "Option 1 / Option 2 …" in English from position; the pasted heading stays in the source excerpt only.                                                                                                               |
| 7   | Units                    | Unit = a measure only. Count items are "2 × name"; the size is in the name as the user wrote it; grams-per-piece is an item attribute the AI estimates (so pear, plum, any fruit works without a table entry).              |
| 8   | Visual direction         | Keep the Supabase palette (emerald + ink ladder). `design.md` stops prescribing austerity: icons, stronger divide-and-grouping, livelier surfaces, a consumer feel, not technical.                                          |
| 9   | Navigation               | Three tabs with Today in the middle; the floating Log meal button stays.                                                                                                                                                    |
| 10  | English food labels      | Hidden everywhere in the UI if nothing depends on them being visible; kept in data for matching and prompts. Fallback if a screen genuinely needs it: meal details and review only.                                         |
| 11  | Rules & notes            | Deferred. Not a V1 feature; it returns later as a properly designed feature. V1 keeps plan instructions as verbatim notes only, nothing is evaluated.                                                                       |
| 12  | Extra meals              | "I had junk food after dinner", "I had two afternoon snacks" must have an obvious place. That place is the existing "Other" link, made explicit and suggested by default when the slot is already recorded or nothing fits. |
| 13  | Photos                   | In the pilot. Tap the button → OS picker (camera or gallery) → DeepSeek identifies the meal and estimates nutrition → draft → the user confirms.                                                                            |
| 14  | Actions                  | Icon-first. Row and secondary actions are icons with an `aria-label` (and at most a one-word label); the pages are too text-heavy.                                                                                          |
| 15  | Deliverable              | This document, then one beads epic per phase with issues linked to the report IDs, created after approval.                                                                                                                  |

---

## 3. Phase A — Truth first (real AI, measured parse quality)

Goal: know what DeepSeek actually returns for this owner's plan and meals before changing the prompt.

| ID  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where                                                                              | Verify                                                        | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- |
| A1  | Point local dev at the real API: `.env` `DEEPSEEK_API_BASE_URL=https://api.deepseek.com`; `.env.example` documents both values; e2e keeps its own stub URL (`e2e/playwright.config.ts` already sets it). Add `npm run dev:stub` for offline work.                                                                                                                                                                                                               | `.env`, `.env.example`, `package.json`, `docs/runbook.md`                          | Log a meal locally; `AiCall` rows show the real model.        | S    |
| A2  | Measure: run `ai:eval` with the 40 meals **plus one fixture per meal of both reference plans** (menu plan: every option of every slot; weekday plan: every slot of every day) written exactly as the plan writes them, and a set of owner-supplied real meals. The owner reviews `expectedItems` and sets `reviewed: true`. Results into the runbook table with the per-meal misses listed.                                                                     | `src/__tests__/fixtures/ai-eval/meals.ts`, `scripts/ai-eval.ts`, `docs/runbook.md` | Recall ≥ 95 % on reviewed rows; every miss has a named cause. | S    |
| A3  | Tighten `meal-text.ts` only where A2 shows real misses. Candidate lines: "every food the description names is its own item — never merge two named foods, never drop a side, drink or condiment"; "a compound phrase that names several foods (خیار گوجه, نان و پنیر) is one item per food unless the app's assumed-default table lists it as one"; a final self-check "the number of items equals the number of foods named". Bump `MEAL_TEXT_PROMPT_VERSION`. | `src/services/ai/prompts/meal-text.ts`, `meal-photo.ts` (shared rules)             | Re-run A2; no regression on slot suggestion (5/5 in O 3.5).   | S–M  |
| A4  | Stub scenarios so e2e can exercise the paths where D1/D5 live: a `SUGGEST` token in the text returns a suggested slot + option; an `ASK` token returns a portion question; a `REFINE` request (see B1) returns the same items with filled values.                                                                                                                                                                                                               | `e2e/stub-ai/server.mjs`                                                           | Used by the new specs in Phase B.                             | S    |

**Gate A:** runbook has a reviewed recall number; the owner has logged the reference-plan meals against the live model and accepts the item lists.

---

## 4. Phase B — Logging-loop correctness

Goal: every one of the six logging paths ends in a saved meal with the user's edits intact and honest slot linking. All P1s and the owner's two new bugs are here.

### B-a. The review loop (O D1, D2, D3, D4, D5; F 1.2-2, 1.5-4, 1.5-9)

| ID  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Where                                                                                                                                      | Verify                                                                                                                                                | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| B1  | **Refine, not re-analyse.** Add a `REFINE` mode to meal analysis: the user message carries the current items (names as the user has them, quantities, units, answered questions, `userOverride` values) and the instruction "return these items in this order; fill quantities and nutrition for items whose portion the answers now make known; keep every name and every user-provided value; explain what changed in `changes[]`". Answering a question triggers a refine automatically (debounced) and Re-estimate uses the same path. | `src/services/meal.service.ts` (`analyzeDraft`, new `refineDraft`), `src/services/ai/prompts/meal-text.ts`, `schemas.ts`, `MealReview.tsx` | Unit: answers produce quantities and totals; renames survive. e2e (stub `ASK`+`REFINE`): answer → totals change; rename → Re-estimate keeps the name. | M    |
| B2  | **Choice answers map to quantities client-side** where the choice is a unit phrase ("a medium bowl" → 1 bowl, "2 slices" → 2 slice) so totals update instantly before the refine returns.                                                                                                                                                                                                                                                                                                                                                  | `src/components/product/meal/questions.ts` (new), `MealReview.tsx`                                                                         | Unit tests on the phrase table.                                                                                                                       | S    |
| B3  | **Option rule.** An option is required only when the recorded items overlap at least one option of the slot (the "I ate this" path). No overlap → save under the slot as _Different food_ with `planOptionId = null`; the row never shows "Option: …" for it. Spec § 7 acceptance line rewritten accordingly.                                                                                                                                                                                                                              | `meal.service.ts` `requireOption`, `MealReview.tsx` `optionRequired`, `PlanSlotRow.tsx` `optionLine`, `docs/product-spec.md` § 7           | Unit + e2e J5: burger under Lunch saves, row reads "A different food was recorded".                                                                   | S–M  |
| B4  | **Extra meals are explicit** (U 12, O D5, F 1.2-2). The slot line on review always states the outcome: "Linked to ناهار" or "Extra meal · not part of your plan". When the AI suggests no slot, or the chosen slot already has a recorded meal, the default is _Extra_ and the row says so; one tap opens the picker. Composer chips mark recorded slots (O D14, F 1.3). Picker copy: "Extra · in addition to your plan" (data key stays `OTHER`).                                                                                         | `meal-composer.tsx` `linkOf`, `MealReview.tsx` slot summary, `meal/SlotPicker.tsx`, `src/messages/sections/meal.ts`                        | e2e: second snack → defaults to Extra with the sentence visible; Today snack row unchanged, Recorded meals shows it.                                  | S    |
| B5  | **Photo on review** (O D4): thumbnails at the top of "Check your meal", tappable to full size.                                                                                                                                                                                                                                                                                                                                                                                                                                             | `MealReview.tsx`                                                                                                                           | Photo e2e (B12).                                                                                                                                      | S    |
| B6  | **No invented noon** (F 1.2-1, O D11): unchecking "I don't remember the time" leaves the field empty and Save disabled until a time is typed.                                                                                                                                                                                                                                                                                                                                                                                              | `MealComposer.tsx` `onTimeChange`                                                                                                          | Unit on the composer state; e2e J6.                                                                                                                   | S    |
| B7  | **Manual entry keeps the typed text** as the first item's name (O D13).                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `meal-composer.tsx` `goManual`                                                                                                             | Unit.                                                                                                                                                 | S    |

### B-b. Composer navigation and the photo button (U new feedback)

| ID  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Where                                                                          | Verify                                                                                                | Size |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---- |
| B8  | **Back and Start over.** The review step gets a back arrow in the sheet header that returns to compose with text and photos intact, and a "Start over" action (icon + label) that discards the server draft and the sessionStorage mirror. When the sheet opens on a restored draft it says "Continuing where you left off" with the same "Start over" beside it, so the user is never stuck in an analysed draft they want to redo from a photo.                                                                                                                | `meal-composer.tsx` (`replaceComp`, mirror), `MealReview.tsx` header, messages | e2e: analyse → close → reopen → Start over → empty compose; back keeps text.                          | S–M  |
| B9  | **Add photo opens the OS picker every time.** Replace the hidden input + programmatic `click()` with a visible `<label>` wrapping the input (the pattern that works in every mobile browser, including inside a modal sheet). On touch devices show two actions: **Take photo** (`capture="environment"`) and **Choose from gallery** (no `capture`); on desktop one "Add photo". If storage is unavailable the picker still opens and the inline error names the reason — the button is never silently inert. Reproduce first on iOS Safari and Android Chrome. | `src/components/product/meal/PhotoPicker.tsx`                                  | Manual on both phones; e2e sets the input through the label; `capture` attribute asserted in the DOM. | S    |

### B-c. Defects by reading (F M1–M3, L1–L7, U1–U2; O D6–D8, D12, D15, D16)

| ID  | Change                                                                                                                                                                                                    | Where                                                    | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---- |
| B10 | F M1: a weekday **range** heading ("شنبه تا پنجشنبه:", "Monday to Friday:") expands to every day in the range instead of the first day.                                                                   | `src/services/ai/interpret-plan.ts`                      | S    |
| B11 | F M2: plan-draft writes conditional on `draftRevision` (`updateMany … where revision`), same for `estimateDraftBaseline`.                                                                                 | `src/services/plan.service.ts`                           | S    |
| B12 | F M3: deleting a meal deletes its S3 objects (and backup copies follow the existing purge path); the storage gauge then matches the bucket.                                                               | `src/services/meal.service.ts`, `services/storage/s3.ts` | S    |
| B13 | O D6 / F U2: score-card eyebrow is "Your plan" with the date for a past day; empty state gains the hint "Your number appears after two planned meals are logged" and hides "Why this score" until scored. | `ScoreCard.tsx`, `WhyThisScore.tsx`, messages            | S    |
| B14 | O D7: "Your plan changed during these days" only when a confirmation happened _after_ the first one in the window.                                                                                        | `src/services/day-view.service.ts` `planChangedBetween`  | S    |
| B15 | O D8: parse local dates without `T00:00:00` (weight measured-on off by one).                                                                                                                              | `settings/profile-section.tsx`, `lib/format.ts` helper   | S    |
| B16 | O D12: onboarding progress is truthful through the review screens; Back on the plan step.                                                                                                                 | `onboarding-flow.tsx`, `plan-review-flow.tsx`            | S    |
| B17 | O D15: Meal details has a top-bar title and hides the FAB.                                                                                                                                                | `src/lib/navigation.ts` `pageTitleFor`, shell layout     | S    |
| B18 | O D16: History does not list days before the account existed.                                                                                                                                             | `history/page.tsx`                                       | S    |
| B19 | F U1: `logoutAction` clears the `appearance` cookie.                                                                                                                                                      | `src/actions/auth.actions.ts`                            | S    |
| B20 | F L1: retries inside one import job spend one admission, not one per attempt.                                                                                                                             | `src/services/jobs/plan-import.job.ts`                   | S    |
| B21 | F L2: time comparison wraps at midnight (00:30 vs 21:00 is 210 min after, not 1,230 before).                                                                                                              | `src/lib/rubric/timing.ts`                               | S    |
| B22 | F L3: skips and completeness refuse future dates like meals do.                                                                                                                                           | `src/services/day.service.ts`                            | S    |
| B23 | F L5: `requireAuth()` in route handlers returns 401 JSON, not an HTML redirect, so the composer shows "Your session ended · Sign in" instead of a generic network error.                                  | `src/lib/auth.ts` (route variant), `app/api/*`           | S    |
| B24 | F L7: saving a draft older than 24 h whose staged photos expired tells the user which photos were dropped.                                                                                                | `meal.service.ts`                                        | S    |
| B25 | O risk 5: the energy fact is withheld from the reflection facts when the day is "complete by default" (fewer slots recorded than the plan lists), so a one-meal day never reads "950 kcal short".         | `src/lib/rubric/facts.ts`                                | S    |

Not fixed on purpose: F L4 (Content-Length pre-check; authenticated and rate-limited) and F L6 (moot once the zone is fixed, C1).

### B-d. Tests and infrastructure

| ID  | Change                                                                                                                                                                                                                                       | Where                                                                 | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| B26 | MinIO service in `docker-compose.yml` and in CI (`S3_*` for the e2e job); `.env.example` documents it. Photo e2e: pick → upload → analyse (stub) → answer → save → details shows the photo → remove photo; flag off hides the button.        | `docker-compose.yml`, `.github/workflows/ci.yml`, `e2e/photo.spec.ts` | M    |
| B27 | e2e for J5 (replaced meal), J6 (backdate incl. unknown time and future refusal), J8 (uncheck completeness), J10 Replace with "N meals affected", weekday plan import → My plan tabs → Today on a weekday (catches B10), composer Start over. | `e2e/*.spec.ts`                                                       | M    |
| B28 | Unit tests for meal-details "Change plan link" and "Reuse as new meal".                                                                                                                                                                      | `src/__tests__/services/meal.service.test.ts`                         | S    |

**Gate B:** gate green; the owner logs a photo meal on a phone end to end, answers a portion question, sees totals change, renames an item, re-estimates, and the name survives.

---

## 5. Phase C — Owner product decisions

Goal: apply decisions 2–7, 9–12 of § 2. Three migrations, all pre-launch (no production data exists; the demo database is disposable). Each migration is named and reviewed before it runs; nothing uses `--force-reset`.

### C1. Time zone fixed to Asia/Dubai (decision 021, supersedes 009)

- `src/lib/time/zone.ts`: `export const APP_TIME_ZONE = 'Asia/Dubai'`. Every caller that today reads `profile.timeZone` reads the constant; the `lib/time` functions keep their `zone` parameter (they stay pure and testable; this is not dead code — it is the one place the constant is injected).
- `Profile.timeZone` stays as a column defaulting to `Asia/Dubai` (day rows carry their zone; the export includes it), but nothing writes it from the UI.
- **Remove:** onboarding step 5 (`TOTAL_STEPS` 8 → 7; step numbers in `Profile.onboardingStep` remapped in the migration), the Settings time-zone field, `today/time-zone-hint.tsx`, `reportDeviceTimeZoneAction`, `dismissTimeZoneHintAction`, `Profile.timeZoneHintDismissedAt`, the `deviceTimeZone` validation, their tests and message keys.
- Migration `0003_fixed_time_zone`: drop the hint column, set the default, remap onboarding steps.
- Docs: product-spec § 5 (no time-zone confirmation), § 11 ("user-confirmed IANA zone" → the app zone), design-scope screen 2 row 5, PRD "Locale", decision 009 marked superseded.
- Size: M.

### C2. Rules & notes deferred (decision 022)

- Plan import extracts **no rules**: the `rules` array leaves the schema and prompt; every instruction that is not a meal, target or schedule becomes a `PlanNote` with its reason (`OTHER` for the ones that were rules). Manual plan setup has no rules step.
- Review flow: screen 8c becomes a read-only "Notes from your plan" list (verbatim, no choices) shown once, then reachable on My plan under "Notes from your plan". History loses the weekly-rules block.
- **Remove:** `lib/rubric/rules.ts` and its types, `plan-review/RulesReview.tsx`, rule progress in `lib/rubric/day-view.ts` and `day-view.service.ts`, `FoodItem.ruleGroups`, the `PlanRule` model and its relations, the rule messages, the rule fixtures and tests. The seven-day pattern sentence is unaffected (it never used rules).
- Migration `0004_defer_rules`: existing `plan_rules` rows are copied into `plan_notes` (`originalText`, reason `OTHER`), then the table and `food_items.ruleGroups` are dropped.
- Docs: product-spec § 6 "Food/behavior rules …", "Explicit timing windows and variety …", the Track/Note/Don't-compare paragraph, § 8 "Meal and rule comparison" variety paragraphs → one line "Rules are not evaluated in V1; plan instructions are kept as notes (decision 022)"; § 10 weekly rules; design-scope 8c; PRD.
- Size: M–L (mostly deletion; the migration and prompt/schema change are the careful parts).

### C3. Option labels are positional

- `PlanOption.label` is kept only as provenance; every render (`PlanSlotRow` option line, composer chips and option list, review slot summary, My plan, plan review `SlotReview`/`SlotEditor`, meal details) uses `t('plan.option.n', { n: position + 1 })` → "Option 1".
- Size: S.

### C4. English labels hidden in the UI

- `NameLabel` and `InlineName` render `originalName` only; `englishLabel` stays in the schema, prompts, matching (`lib/rubric/names.ts`), restrictions and the eval harness.
- Audit of every place where the English label was the only readable text: rule progress (gone in C2); `facts.ts` `originalName (englishLabel)` → original only; the reflection prompt gets "quote food and slot names exactly as the user wrote them, without a translation"; the seven-day sentence uses the original slot name.
- Fallback if a real obstacle appears (none expected): show the label in meal details and review only.
- Size: S.

### C5. Reflection: static states, warmer copy, "Got it"

- `reflection.service.ts` `generate`: when `pickFallbackState` is `NO_RECORDS`, `FIRST_DAY` or `NO_PLAN`, finish with the deterministic paragraph **without** admitting or calling the provider; mark the row `isStatic` (a new boolean, distinct from `isFallback`, so analytics do not count it as a failure and "Update reflection" is not offered).
- Copy rewritten in `src/messages/sections/reflection.ts` (proposed; the owner edits freely):
  - **No records yesterday:** "Good morning, {name}. Yesterday went by without any meals logged — that happens, and nothing is lost. Today is a fresh page: your plan starts with {slot}, and logging it takes a few taps. If you'd like to fill in yesterday, History is always open. One meal at a time is plenty."
  - **First day:** "Good morning, {name}, and welcome. There's nothing to look back on yet — today is day one. Your plan starts with {slot}; when you eat it, log it and adjust the portions to what you actually had. From tomorrow on, this card will tell you how the day before went. One meal at a time is plenty."
  - **No plan:** "Good morning, {name}. Your meals can't be compared with anything yet because there's no plan. Add it from the Plan tab whenever you're ready; until then, everything you log still counts towards your totals. One meal at a time is plenty."
  - Afternoon and evening greetings and closes keep their time-appropriate variants.
- **Got it:** the card shows a single icon+label action "Got it". Tapping it stores `acknowledgedAt` for that date (replaces the `collapsed` flag) and the card moves to the bottom of Today, above the completeness checkbox, collapsed to its title with "Read again". Until then it sits at the top as the morning moment. A stale reflection ("based on an earlier log") reopens at the top with "Update reflection".
- Migration: `MorningMessage.isStatic` boolean, `collapsedAt` → `acknowledgedAt` (rename).
- Docs: product-spec § 9 hierarchy and § 11 "AI unavailable" row → "AI unavailable **or no data to reflect on**"; design-scope screen 3.
- Size: M.

### C6. Meal time windows (UI only)

- `PlanSlot` gets `timeAssumed Boolean @default(false)`. When the plan states times (`timeStart/timeEnd` from import or the slot editor) they are used as-is. Otherwise a deterministic table assigns a window from the English label keyword, in `lib/rubric/windows.ts`: breakfast 06:00–10:30, morning/first snack 10:00–12:30, lunch 12:00–15:30, afternoon/second snack 15:00–18:30, dinner 18:30–23:00, pre-workout/post-workout/before bed by keyword, and for unrecognised names an even split of 07:00–22:00 in plan order. Assigned windows are written on confirm with `timeAssumed: true`; editing them in the existing slot editor clears the flag. No new editing surface.
- The rubric ignores assumed windows: timing stays on the order rule (`timing.ts` reads `timeAssumed`). Decision 3 of § 2.
- Today: `SlotView` gains `windowState: 'UPCOMING' | 'OPEN' | 'PASSED'` computed in `day-view.service.ts` from now in `APP_TIME_ZONE`. `PlanSlotRow`: OPEN and PASSED unrecorded rows show the icon actions **Log** (＋) and **Skip** (—); PASSED additionally shows the muted line "Window passed · log it or mark skipped"; UPCOMING rows show one small faint ＋ (icon-only, 36 px, `aria-label`). The highlighted row is the first OPEN/PASSED unrecorded slot; its action is an outline button so the FAB remains the only filled emerald (decision 019, O 9, F 2.4-3).
- My plan shows the window on each slot ("≈ 12:00–15:30" when assumed, "12:00–15:30" when stated).
- Migration `0005_slot_windows` (can share a migration with C5).
- Docs: product-spec § 6 "Optional meal times/windows" + § 9 "Highlight the next unrecorded slot" → window-based; § 8 unchanged (timing thresholds apply to stated times only; assumed windows are explicitly excluded).
- Size: M.

### C7. Navigation order

- `PRIMARY_TABS`: History · Today · My plan. The FAB stays. Size: XS.

### C8. Units (decision 023)

- **Unit table = measures only:** `g, kg, ml, l, glass, cup, tsp, tbsp, bowl, slice, sheet, piece, skewer, handful, serving`. Removed keys: `medium_apple, small_banana, medium_banana, date, slice_sangak, slice_barbari, slice_lavash, slice_taftoon, slice_toast, egg, medium_orange, medium_tomato, medium_cucumber, medium_potato, walnut, almond, skewer_kabab`.
- **New item attribute** `unitGrams Decimal?` on `PlanItem` and `FoodItem`: grams for one unit of _this_ item when the unit is a count (`piece, slice, sheet, skewer, handful, serving, bowl, glass, cup` for foods without a density). The AI fills it from its knowledge plus a _hint table_ the prompt still receives (medium apple ≈ 180 g, date ≈ 8 g, sangak slice ≈ 80 g, egg ≈ 50 g, walnut kernel ≈ 4 g …) — the hints stay, the unit keys go. The size stays in the name as the user wrote it ("سیب کوچک"); when no size was written the AI assumes medium and details show "≈ 180 g each · assumed medium".
- **Rendering:** count units read "2 × سیب", "1 slice · نان سنگک", "3 × گردو"; measures read "150 g · مرغ". Plurals handled by `tp()` (O D10). The review row gets a stepper for count units.
- **Rubric:** `portion.ts` converts through `unitGrams` when either side is a count unit (plan item and recorded item may differ in unit: 1 slice vs 80 g); "Not evaluated" when neither side has grams.
- **Prompts:** `unitsSection()` lists the measures; a new `foodWeightHints()` section replaces `ASSUMED_DEFAULTS` for counts; `NUTRITION_SHAPE` unchanged.
- Migration `0006_count_units`: for every row with a removed key, set `unit` to the measure (`piece`/`slice`/`sheet`/`skewer`), `unitGrams` to the old table weight, and leave the name untouched.
- Docs: product-spec § 6 "Household units" paragraph; PRD.
- Size: M–L.

**Gate C:** gate green; migrations reviewed; the owner imports the reference plan again on the real API and checks: no time-zone step, "Option 1/2", no English sub-labels, notes list instead of rules, windows on My plan, count items as "2 × …".

---

## 6. Phase D — Visual re-skin toward B2C

Goal: the app feels like a companion, not a console. Same palette, same kit, same tokens architecture; what changes is what `design.md` allows and how the product surfaces use it.

### D0. `design.md` revision and decision 024 (amends 019)

Add a "Product UI" section that overrides the marketing austerity for app screens:

- **Surfaces, three of them:** _hero_ (the score card: tinted emerald 6–8 % background, 16 px radius, level-1 shadow, the only elevated surface), _list_ (hairline container, rows separated by hairlines, 12 px radius), _note_ (borderless, `muted` background or a 3 px emerald start rule; reflection, hints, empty states). Cards stop being the default wrapper for everything.
- **Grouping by surface and glyph, not by font size:** every section header is icon + title (Sun for Today's plan, Utensils for Recorded meals, Sparkles for the reflection, CalendarDays for History, ClipboardList for My plan); section spacing 24 px, in-section 12 px.
- **Status glyph set** (neutral colour, shape carries meaning; the no-colour-only rule holds): ○ not recorded · ● recorded/matched · ◐ partly · ⊘ different food · — skipped · ? needs review · ◷ upcoming. Score band gets a glyph too.
- **Icon-first actions:** primary = filled emerald with icon + one word; secondary and row actions = icon buttons with `aria-label`, 44 px on rows, 36 px only inside dense editors. Text buttons only where the verb needs a sentence (destructive confirmations).
- **Shape:** cards 16 px, chips pill-shaped (allowed now), buttons 10 px. Tint ladder: `--tint-1/2/3` emerald at 4/8/14 % for hero, selected and pressed.
- **Typography:** one display face via `next/font` (Manrope or Plus Jakarta Sans — the owner picks from two screenshots), system stack for body; weight ceiling 600; the score numeral at 40 px.
- **Illustrations:** simple two-tone line illustrations (emerald + ink) for empty states (no plan, no meals, first day) and the onboarding Ready screen. Never photography.
- **Motion:** 150–250 ms; the score numeral counts up once per change; skip/unskip optimistic.
- Keep: emerald once per viewport as the filled primary; status never colour-only; 44 px targets; tokens as CSS variables; both themes.

### D1. Today

| ID  | Change                                                                                                                                                                                                 | Source                        | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---- |
| D1a | Score card as the hero surface: band glyph + 40 px numeral (or the band word alone), a thin "2 of 5 recorded" progress ring or bar, coverage line, "Why this score" only once something is scored.     | O 5, F 2.4-1, F 1.4           | M    |
| D1b | Slot rows: leading status glyph; name; one status line; window state; icon actions per C6; expanded details unchanged. The highlighted row uses an outline action; the FAB is the only filled emerald. | O 9, F 2.3, F 2.4-2/3, U      | M    |
| D1c | Reflection card as the note surface with the Sparkles header, "Got it" action (C5); collapsed title strip at the bottom after reading.                                                                 | U 4, F 1.4, O 1.2-B           | S    |
| D1d | Nutrition details: value / target two-column rows with a thin neutral bar; source and status behind a per-row disclosure.                                                                              | O 2.2-6, F 2.4-5              | S    |
| D1e | Recorded meals: rows with time, name, kcal, a camera glyph when photos exist, chevron.                                                                                                                 | F 2.4-6                       | S    |
| D1f | Empty states with illustrations: no plan, first day, nothing recorded.                                                                                                                                 | O 1.2-B, § 9 essential states | S    |

### D2. Log meal (composer and review)

| ID  | Change                                                                                                                                                                                                                                                                                                                                       | Source                      | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---- |
| D2a | Intent-aware compose: opened from a slot row → option list first (chips titled "Option 1 …", "Last time" pill, nothing preselected), then "Something else?" with the text box and the two photo actions. Opened from the FAB → text and photo first, planned slots as chips beneath, recent meals as a horizontal strip only when non-empty. | O 3, O 5, F 1.5-1, F 1.5-10 | M    |
| D2b | Compact review: one row per item (name · quantity · kcal · chevron); tapping expands the editor (quantity stepper or field, unit select, unknown toggle, alternatives). "Estimated" badge removed from the default state; only "Assumed", "Label value" and "Needs a new estimate" remain as badges.                                         | O 6, O 4, F 1.3, F 1.5-2    | M    |
| D2c | Pinned footer: date/time summary + Save meal (filled) with the slot sentence above it; date, time, notes under "More details" as the spec says.                                                                                                                                                                                              | F 1.5-2, spec § 7           | S    |
| D2d | Rename "Analyze" → "Check this meal"; photo actions "Take photo" / "Choose from gallery" (B9).                                                                                                                                                                                                                                               | F 1.3, U                    | XS   |
| D2e | Questions block: one card, choices as pills, answered pills tinted; the totals strip updates as answers are given (B1/B2).                                                                                                                                                                                                                   | O 1.2-3                     | S    |

### D3. History, My plan, Meal details, Settings, Onboarding, Shell

| ID  | Change                                                                                                                                                                                                                                                                                                                | Source                      | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---- |
| D3a | History: summary as one note surface with an icon and a hierarchy (headline sentence, then the two counts as small lines); day rows with band glyph + word + number; "complete by default" reworded "Marked complete · 2 of 5 meals recorded"; the seven-day sentence split into different-food and skipped variants. | F 1.2-6/7, F 1.5-8, O 2.2-1 | S–M  |
| D3b | My plan: slot cards with clock and window (C6), flame glyph + kcal range, options as pills ("Option 1 · 3 items"), slots collapsed after the first two, "Notes from your plan" at the end (C2).                                                                                                                       | F 2.2, F 2.4-6              | M    |
| D3c | Meal details: top-bar title (B17), photo strip first, items as compact rows, differences as chips, actions as icon buttons (Edit, Reuse, Delete).                                                                                                                                                                     | O D15                       | S    |
| D3d | Settings: no duplicated h1; "Delete account" as a text-destructive button with the existing confirm; privacy text under a disclosure; the Tools section admin-only.                                                                                                                                                   | O 2.2-7/8, F 1.1            | S    |
| D3e | Onboarding: 7 steps (C1), truthful progress (B16), Back everywhere, an illustration on the Ready screen.                                                                                                                                                                                                              | O D12, F 2.2                | S    |
| D3f | Shell: Today centred (C7); desktop uses one header row (tabs inside the top bar); toaster top-centre under the bar; 2 px focus ring with offset; neutral skeletons; one h1 size; 44 px icon buttons on rows.                                                                                                          | O 2.2-7, F 2.3, F 2.4-7/8   | S–M  |

**Gate D:** `/components` gallery updated for both themes; axe spec green in both themes; screenshots of every screen at 390 × 844 light and dark reviewed by the owner; one emerald per viewport verified on Today, History day, Meal details.

---

## 7. Phase E — Launch readiness

| ID  | Change                                                                                                                                                                                                                                                                                                                                       | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| E1  | Docs: product-spec (§ 5 time zone, § 6 rules deferred + units + windows, § 7 option rule + extra meals + Start over, § 8 assumed windows excluded, § 9 hierarchy + Got it, § 11 static states, § 12 copy table), design-scope (screens 2, 3, 4, 6, 7, 8c), design.md "Product UI", PRD, runbook, decisions 021–024, decision 009 superseded. | M    |
| E2  | Tests: unit suites updated for units/rules/zone; new e2e from B26–B27 and C; a11y spec re-run; `ai:eval` reviewed rows ≥ 95 % recall; the photo evaluation (20 photos) run and recorded in the runbook so `PHOTO_LOGGING_ENABLED=true` in production is a measured decision.                                                                 | M    |
| E3  | Ops: S3 variables in the Darkube config; MinIO in CI; the existing "Not done yet" checklist in the PRD (Darkube app, Supabase buckets, round trip `R`, ingress timeout, restore rehearsal).                                                                                                                                                  | M    |
| E4  | Owner phone walkthrough (iOS Safari + Android Chrome), light and dark: sign-up → 7 steps → paste plan → review → Today → planned meal (3 taps) → text meal with a question → photo meal → extra meal after dinner → History → My plan → Settings → log out. Every step green before inviting users.                                          | S    |

---

## 8. Traceability — every finding and remark, where it went

### Opus report

| Finding                                           | Plan item                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 answers never consumed                         | B1, B2                                                                                                                                                     |
| D2 re-estimate discards corrections               | B1                                                                                                                                                         |
| D3 option always required                         | B3                                                                                                                                                         |
| D4 photo absent from review                       | B5                                                                                                                                                         |
| D5 unlinked meal silently Other                   | B4                                                                                                                                                         |
| D6 past-day caption                               | B13                                                                                                                                                        |
| D7 "plan changed" for first plan                  | B14                                                                                                                                                        |
| D8 date off by one                                | B15                                                                                                                                                        |
| D9 slot rows never expand options                 | D1b + D2a (options open in the composer from the row; spec § 9 wording updated to say so — no inline expansion, to keep one place for the option decision) |
| D10 unit plurals                                  | C8                                                                                                                                                         |
| D11 12:00 prefill                                 | B6                                                                                                                                                         |
| D12 progress bar / Back                           | B16, D3e                                                                                                                                                   |
| D13 manual entry drops text                       | B7                                                                                                                                                         |
| D14 chips don't mark recorded slots               | B4                                                                                                                                                         |
| D15 meal details title / FAB                      | B17, D3c                                                                                                                                                   |
| D16 pre-signup days in History                    | B18                                                                                                                                                        |
| Ranked 5 composer leads with text                 | D2a                                                                                                                                                        |
| Ranked 6 review too tall                          | D2b, D2c                                                                                                                                                   |
| Ranked 9 two emeralds / status as text            | D1b, D0                                                                                                                                                    |
| Ranked 10 photo e2e / S3 in CI                    | B26, E3                                                                                                                                                    |
| 1.2-B prescribed option vs its own range          | Not changed: the per-meal energy line stays in details only and never enters the score (spec § 8). Revisit if the pilot reports confusion.                 |
| 1.4-1 questions feed estimate                     | B1                                                                                                                                                         |
| 1.4-2 option rule                                 | B3                                                                                                                                                         |
| 1.4-3 baseline vs range                           | See 1.2-B                                                                                                                                                  |
| 1.4-4 first-day state in the AI prompt            | Moot: first day is static (C5)                                                                                                                             |
| 1.4-5 energy fact on complete-by-default          | B25                                                                                                                                                        |
| 1.5 rule review shows only source                 | Moot: rules deferred (C2)                                                                                                                                  |
| 1.5 "Change" label / double select                | D2c (slot sentence + picker)                                                                                                                               |
| 1.5 `capture` hint                                | B9                                                                                                                                                         |
| 1.5 recent chip titled by first item              | D2a (chip titled by slot/option, then items)                                                                                                               |
| 1.5 FAB covers photos on details                  | B17                                                                                                                                                        |
| 2.2-1 monotony · 2.2-2 status shape · 2.2-3 icons | D0, D1                                                                                                                                                     |
| 2.2-5 review density · 2.2-6 nutrition table      | D2b, D1d                                                                                                                                                   |
| 2.2-7 title duplication / desktop headers         | D3d, D3f                                                                                                                                                   |
| 2.2-8 destructive styling                         | D3d                                                                                                                                                        |
| 2.2-9 small unfinished things                     | B13, B16, D2b, D2c, D3b                                                                                                                                    |
| 3.6 stub scenarios, J5/J6/J8 e2e, eval unreviewed | A4, B27, A2                                                                                                                                                |

### Fable report

| Finding                                                                           | Plan item                                                                                                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 login page has no value line                                                  | D3e (one line on `/login`)                                                                                                                   |
| 1.1 "Confirm portion" does not exist                                              | Struck from design-scope in E1: Needs review has one resolving action, "Choose option".                                                      |
| 1.1 Save not pinned                                                               | D2c                                                                                                                                          |
| 1.1 pattern sentence merges two cases                                             | D3a                                                                                                                                          |
| 1.1 Settings "Tools" section                                                      | D3d (admin-only)                                                                                                                             |
| 1.1 J6 no explicit confirm-time step                                              | B6 (empty time + disabled Save is the explicit step)                                                                                         |
| 1.2-1 invented noon                                                               | B6                                                                                                                                           |
| 1.2-2 silent Other                                                                | B4                                                                                                                                           |
| 1.2-3 past-day "today"                                                            | B13                                                                                                                                          |
| 1.2-4 Needs review resolved off-page                                              | Kept as a link to meal details (one place to change the option); wording "Choose option ›". Inline radios not built — the row stays compact. |
| 1.2-5 three stories for one meal                                                  | D1b/D3c: the row status, the detail chip and Why-this-score use the same wording set; "Matches your plan" only when portion is also small.   |
| 1.2-6/7 seven-day sentence, row vocabulary                                        | D3a                                                                                                                                          |
| 1.3 composer order, review length, "Analyze", "Estimated", recorded chips         | D2a, D2b, D2d, B4                                                                                                                            |
| 1.4 reflection above the fold, empty score card, history summary, nutrition heavy | C5, B13, D3a, D1d                                                                                                                            |
| 1.5-1 … 1.5-10                                                                    | D2a, D2c, C5, B4, B6, B13, (see 1.2-4), D3a, B3, D2a                                                                                         |
| 2.1 weight ceiling, skeleton tint, focus ring, 36 px targets, toaster             | D0, D3f                                                                                                                                      |
| 2.2 two emeralds, status labels, review cards, My plan wall, appearance cookie    | D1b, D0, D2b, D3b, B19                                                                                                                       |
| 2.3 heuristics table                                                              | D0, D1, D3f                                                                                                                                  |
| 2.4-1 … 2.4-8                                                                     | D0, D1b, D1b, C5, D1d, D1e/D3b, D3f, D3f                                                                                                     |
| 3.3 photo path unverified locally                                                 | A1, B26                                                                                                                                      |
| 3.5 M1, M2, M3                                                                    | B10, B11, B12                                                                                                                                |
| 3.5 L1 … L7                                                                       | B20, B21, B22, not fixed (L4), B23, moot (L6), B24                                                                                           |
| 3.5 U1, U2                                                                        | B19, B13                                                                                                                                     |
| 3.6 coverage gaps                                                                 | B26, B27, B28, C6 tests                                                                                                                      |
| 4-4 photo evaluation, 4-5 fixtures reviewed                                       | E2, A2                                                                                                                                       |

### Owner feedback

| Remark                                                                 | Plan item                      |
| ---------------------------------------------------------------------- | ------------------------------ |
| Main tab in the middle with an odd tab count                           | C7                             |
| Dry, B2B feel; few icons; flat sections; grouping by font              | D0, D1–D3                      |
| Reflection read once a day; "Got it" → moves down                      | C5, D1c                        |
| "Other" for meals outside the plan; junk food after dinner; two snacks | B4                             |
| Everything except user content in English; "گزینه ۱"                   | C3, C4                         |
| No time-zone notice; everyone Asia/Dubai                               | C1                             |
| Count units: size in the name, unit is a unit; pear tomorrow           | C8                             |
| AI parse drops foods; work with the sample plan                        | A1–A3                          |
| A time window per meal; CTAs for open and passed slots                 | C6, D1b                        |
| No timing score from windows                                           | C6                             |
| Faint action for upcoming slots if it takes little space               | C6 (36 px icon-only)           |
| Icon-first actions, less text                                          | D0, D1b, D2, D3c               |
| Static reflection for empty days, no wasted AI call; better copy       | C5                             |
| What is the English label for                                          | C4 (kept for matching, hidden) |
| Rules & notes not thought through; later                               | C2                             |
| Photo: tap → OS picker → DeepSeek → draft → confirm                    | B9, B1, B5, B26                |
| Composer stuck in the analysed step; no back / start over              | B8                             |
| Add photo button does not react; expected camera/gallery               | B9                             |

---

## 9. Out of scope for this plan (unchanged deferred list)

Everything in product-spec § 3 "Deferred" stays deferred. In addition, from the reviews: Redis login throttle, error tracker, Content-Length hardening (F L4), inline option radios on Today rows, per-meal range vs baseline reconciliation (O 1.2-B), rules tracking as a feature (returns with its own spec), inline slot option expansion on Today (O D9 — the composer is the one place for that decision).

## 10. Working agreement for the phases

- One beads epic per phase, one issue per plan ID, each issue carrying the source IDs; issues are closed only after the owner confirms.
- Scope stays as written here; anything discovered on the way is recorded as a new issue, not done in passing.
- Migrations are reviewed by name before they run; no reset commands.
- Every phase ends with the gate and a short note in `docs/PRD.md`; decision records land with the phase that changes the rule.
