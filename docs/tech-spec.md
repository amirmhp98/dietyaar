# Technical specification — Diet adherence companion

Version: 1.2.2 — September 17, 2026: review-round amendments (row identity by id in edit drafts, `draftId`/`draftSourceText`, baseline reviewed in the draft, atomic job claim, `clientRequestId` on save, operation-level AI caps, encrypted age-based backups, 1280 px photos — implementation-plan.md § 10); planning-time defaults recorded (thinking-off request field, Sentry through a tunnel route so CSP stays `connect-src 'self'`, scheduler on in e2e, `DEEPSEEK_API_BASE_URL`); see implementation-plan.md § 3.4
Date: September 17, 2026
Status: Proposed. Derived from `product-spec.md` v1.7 and `design-scope.md` (September 16, 2026), which already incorporate the owner decisions in section 0.1. Owner decisions still open are in section 19 with the default that applies until revised.
Baseline: `mhp-nextjs-boilerplate` at commit `a622806`, set up with `./setup.sh dietyaar --locale en`.
Target platform: Hamravesh Darkube (Kubernetes PaaS), Docker image deployment. Database and file storage on Supabase free tier.

## 0. How to read this document

`product-spec.md` owns product behavior. `design-scope.md` owns the screen inventory. `design.md` owns visual treatment. This document owns how the product is built, run, and verified.

### 0.1 Owner decisions that supersede the product spec

These were given after product spec v1.6 and are binding. Product spec v1.7 and the design scope have been updated to match; section 22 records what changed.

| Decision                                         | Date               | Effect                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No password recovery in V1                       | September 16, 2026 | No recovery email, no forgot-password form, no reset page, no email of any kind. A lost password loses the account.                                                                                                                                                       |
| Supabase free tier for database and file storage | September 16, 2026 | Section 13.                                                                                                                                                                                                                                                               |
| No plan versions                                 | September 16, 2026 | One plan per user, edited in place. Editing or replacing the plan changes how every day, past and future, is compared, and the UI says so. No version history, no per-day plan assignment, no effective dates, no re-activation of old versions. Section 5 and section 6. |
| Keep features minimal                            | September 16, 2026 | Where this document offered a cache, a history table, or a second mechanism, the simpler one is now the only one.                                                                                                                                                         |

Where this document and the product spec still disagree on something not covered above, the product spec wins and this document is wrong.

### 0.2 Tags and terms

Every section is tagged with how it relates to the boilerplate: **Inherited** (the boilerplate does this; only deviations are listed), **Extended**, **Replaced**, or **Added**. Rules that change a boilerplate rule get a decision record under `docs/decisions/` numbered from 008; section 18 lists them.

Terms: **plan** is the user's one diet. **Slot** is a named meal position in the plan on a given weekday. **Option** is one of several prescribed alternatives for a slot. **Meal** is a confirmed record of food eaten. **Draft** is an unsaved meal in analysis or review. **Day** is a calendar date in the app time zone (decision 022). **Rubric** is the versioned scoring rule set from product spec section 8. **Tunable** marks a number chosen as a default, not derived from a requirement.

## 1. Goals, non-goals, constraints

### Goals

1. Ship the first release on one Docker image, one PostgreSQL database, one storage bucket, and one AI provider.
2. Keep every product rule in application code that is unit-testable without a network: matching, scoring, completeness, nutrition subtotals, staleness, day boundaries.
3. Make every promise in this document name its data, its state transitions, its failure behavior, and an acceptance scenario (section 21).
4. Keep the codebase navigable by AI coding agents: the boilerplate's lint-enforced layering stays intact and every module follows the reference shape.
5. Be operable by one person: one deploy pipeline, one log stream, one error tracker, one runbook.

### Non-goals

Anything in product spec section 3 "Deferred", plus: plan history, multi-region, read replicas, message queues, a third-party API, native push, offline-first sync, real-time collaboration, admin analytics beyond the boilerplate Users module.

### Constraints

| Constraint                                      | Source                  | Consequence                                                                                                                                                                                                               |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting on Darkube, Iran-based cluster          | Owner                   | Docker image deploy; shared IPv4 egress; Docker Hub only through `hub.hamdocker.ir`; no privileged containers; no native cron; reachability of every foreign API verified from the cluster before product code is written |
| Supabase free tier                              | Owner                   | 500 MB database, 1 GB files, 5 GB egress per month, 50 MB per file, no provider backups, project paused after 7 idle days, database reachable over IPv4 only through the Supavisor pooler; Data API must be disabled      |
| Unpaid first release, single developer          | Product spec            | One replica; no managed queue; AI cost caps                                                                                                                                                                               |
| English UI, Gregorian dates, any-language input | Product spec            | `en` locale profile; one app time zone (decision 022); original text stored verbatim                                                                                                                                      |
| DeepSeek as AI provider                         | Owner                   | Adapter isolates the provider; JSON mode without schema enforcement; every response validated with zod                                                                                                                    |
| Mobile-first web app                            | Product spec            | Bottom tab shell replaces the boilerplate sidebar; Playwright runs a mobile project                                                                                                                                       |
| Health data privacy                             | Product spec section 15 | Private bucket; photo bytes reach the browser only through an owner-checked route; logger and error-tracker redaction; no health content in analytics                                                                     |
| No password recovery, no email                  | Owner                   | Sign-up is username and password only                                                                                                                                                                                     |

## 2. System architecture — Inherited, extended

One Next.js 16 application serves pages, server actions, and route handlers. It talks to Supabase Postgres through Prisma via the Supavisor pooler, to Supabase Storage through its S3-compatible API, to Hamravesh Object Storage for backups through the same S3 adapter, and to DeepSeek and USDA over HTTPS. A scheduler runs inside the same process under a database lease. There are no other services.

```
Browser (mobile web)
  │  HTTPS (Darkube ingress, TLS, HTTPS redirect)
  ▼
dietyaar-web on Darkube (Next.js 16, node:lts-slim, 1 replica, :3000)
  ├─ pages + server actions + route handlers
  ├─ services/ (domain logic, framework-free)
  ├─ ai/ (DeepSeek adapter), food-data/ (units, USDA), storage/ (S3 adapter)
  └─ scheduler (instrumentation.ts, JobLock lease + heartbeat)
  │                    │                     │                    │
  ▼                    ▼                     ▼                    ▼
Supabase Postgres   Supabase Storage    Hamravesh Object     DeepSeek API
(pooler 6543 txn,   (private bucket)    Storage (backups,    (api.deepseek.com)
 5432 session)                           Iran)
```

The app runs in Iran; the data runs on Supabase outside Iran. Every request that touches data crosses that boundary. Section 13 step 2 measures the round trip before anything else is built, and section 17 sets the query budget per page.

### Request paths

| Path            | Mechanism                                                                               | Why                                                                                       |
| --------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Reads for pages | Server components call services                                                         | Boilerplate rule                                                                          |
| Mutations       | Server actions returning `ActionResult`                                                 | Boilerplate rule; typed, same-origin                                                      |
| Photo upload    | Route handler `POST /api/uploads`, multipart                                            | Server actions cap bodies at 2 MB; validation and re-encoding happen in one pass          |
| Plan import     | Job row in Postgres, run by the scheduler, polled by the client through a server action | No queue; survives navigation; resumable                                                  |
| Meal analysis   | Server action with one overall deadline                                                 | Bounded wait; draft is server-held so nothing is lost                                     |
| Reflection      | Server action that claims generation, with a client poll for concurrent visitors        | One canonical paragraph per user per day                                                  |
| Data export     | Route handler `GET /api/export` streaming a zip                                         | Binary download                                                                           |
| Photo view      | Route handler `GET /api/photos/[id]?s=<session-tag>` streams the object                 | Bucket stays private; the browser never contacts Supabase; the cache key is account-bound |
| Health          | `GET /api/health` (readiness), `GET /api/live` (liveness)                               | Section 13                                                                                |

### Process model

Single replica. The scheduler, the login throttle, and the rate limits are in-process and reset on deploy, which is acceptable at one replica. Section 12 states the one change needed at more than one replica.

## 3. Stack — Inherited

Everything below comes from the boilerplate and is kept. Reasons are in its `docs/decisions/001` to `007`.

| Layer      | Choice                                                                             | Notes for this project                                                                                                |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Runtime    | Node LTS on `hub.hamdocker.ir/library/node:lts-slim`                               | Darkube mirror and `library/` prefix                                                                                  |
| Framework  | Next.js 16 App Router, React 19, React Compiler                                    | `src/proxy.ts` is the request gate                                                                                    |
| Styling    | Tailwind 4, locally owned shadcn kit behind one barrel, logical CSS utilities      | Persian names render inside the English layout                                                                        |
| Data       | Supabase Postgres, Prisma 6, committed migrations                                  | `url` is the transaction pooler, `directUrl` the session pooler; every `DateTime` column carries `@db.Timestamptz(3)` |
| Validation | zod 4 with `t()` messages                                                          | Also validates every AI response                                                                                      |
| Auth       | Cookie sessions with hashed tokens, bcrypt 12 rounds                               | Extended in section 8                                                                                                 |
| Tests      | Vitest 5 with deep-mocked Prisma, Playwright                                       | Extended in section 15, plus a real-Postgres integration project                                                      |
| Lint       | ESLint layering rules, Prettier, `tsc`                                             | Section 4 adds rules; section 9 keeps one narrow RTL check                                                            |
| Ops        | Multi-stage Dockerfile, standalone output, migrations on start, health route, pino | Adapted in section 13                                                                                                 |

### Added dependencies

| Package                  | Purpose                                                              | Alternative rejected                                 |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `@aws-sdk/client-s3`     | Supabase Storage and Hamravesh Object Storage through one S3 adapter | Vendor SDKs: two clients for one protocol            |
| `sharp`                  | Re-encode uploads to JPEG, strip metadata, resize                    | Jimp: too slow for 10 MB inputs                      |
| `heic-to` (browser only) | Convert HEIC to JPEG on the device                                   | Server-side HEIC: prebuilt sharp has no HEIC decoder |
| `@date-fns/tz`           | Time-zone-aware day boundaries on the boilerplate's `date-fns` 4     | Luxon: a second date library                         |
| `archiver`               | Streaming zip for data export                                        | Manual zip                                           |
| `@sentry/nextjs`         | Error tracking to Hamravesh Sentry                                   | Rolling our own                                      |

No AI SDK. The DeepSeek adapter uses `fetch` with `AbortSignal`, because the surface used is small and a raw client gives exact control over deadlines.

## 4. Repository layout and module boundaries — Extended

```
src/
  app/
    (auth)/login, signup/                                  public pages
    (app)/
      layout.tsx            bottom tabs + Log meal (REPLACED)
      today/, history/, plan/, settings/, meals/[id]/      product pages
      onboarding/           one question per screen
      admin/users/          boilerplate Users module, ops tool
    api/health, api/live, api/uploads, api/photos, api/export/
  actions/                  one file per module
  services/
    <module>.service.ts     domain orchestration (existing pattern)
    ai/                     ADDED: DeepSeek adapter, prompts, schemas, eval harness
    food-data/              ADDED: unit table, USDA lookup, nutrition scaling
    storage/                ADDED: S3 adapter (two configured targets)
    jobs/                   ADDED: scheduler, job runner, cleanup, backup
  lib/
    validations/<module>.ts
    time/                   ADDED: local date, day bounds, time bands
    rubric/                 ADDED: pure comparison and scoring functions
    text/                   ADDED: digit and character normalization for parsing copies
    common-passwords.ts     ADDED: top-10k list
  components/
    ui/                     shadcn kit (existing)
    product/                ADDED: the 12 shared components from design-scope.md
    layout/                 shell (REPLACED)
  messages/en.ts
  instrumentation.ts        starts the scheduler
  __tests__/                unit (mocked Prisma), integration (real Postgres), fixtures/
prisma/
e2e/
docs/decisions/008+.md, docs/runbook.md
```

### Layering rules added to the boilerplate's

Implemented as `no-restricted-imports`, type-only imports allowed:

1. `services/ai/**` may not import `@/lib/prisma`. The adapter returns validated data plus usage; the calling service persists both the result and the `AiCall` row.
2. `lib/rubric/**`, `lib/time/**`, `lib/text/**` import nothing from `@/services` or `@/lib/prisma`. They take plain numbers and strings; the service converts Prisma `Decimal` to `number` at the boundary and back.
3. `components/product/**` may not import `@/actions/*`. Product components receive callbacks from page-level islands.
4. Nothing outside `lib/locale.ts` and `lib/format.ts` may read `locale.timeZone` (decision 022).

### Module inventory

| Module               | Owns                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `account`            | sign-up, password change, deletion                                 |
| `profile`            | onboarding steps and resume, profile, preferences, AI notice flags |
| `plan`               | the one plan, import job, draft review, confirm, targets, notes    |
| `meal`               | drafts, analysis, confirmed meals, food items, photos, slot link   |
| `day`                | completeness, skipped slots, comparison, history summaries         |
| `reflection`         | morning message, staleness, fallbacks                              |
| `export`             | data export zip                                                    |
| `user` (boilerplate) | admin user management                                              |

## 5. Data model — Added

Prisma schema on Postgres. All tables carry `createdAt`, `updatedAt` (`timestamptz`). Rows owned by a user carry `userId` with an index and cascade delete; child rows (slots, options, items, food items) are owned through their parent and every service query joins to the parent's `userId`. IDs are `cuid()`. Quantities are `Decimal(10,2)`; nutrient values are numbers inside JSON, rounded to three decimals.

The model has 15 tables. Nothing is cached; comparisons are computed on read (section 6).

### Identity and settings

**User** (boilerplate, extended): `usernameLower` `citext` unique; `deletionRequestedAt`, `deletionScheduledFor` nullable; `onboardingStep` enum (`AGE`, `SEX`, `HEIGHT`, `WEIGHT`, `TIME_ZONE`, `DISPLAY_NAME`, `PLAN`, `REVIEW`, `READY`, `DONE`). No email column.

**Session** (boilerplate): unchanged.

**Profile**: one per user, created at the `SEX` step (age is validated before it is written, so an under-18 user never gets a row). Columns are nullable until `completedAt` is set; the service refuses to set `completedAt` unless `ageYears`, `sex`, `heightCm`, `weightKg` are present. `weightMeasuredAt` date, `unitSystem` (`METRIC`, `IMPERIAL`), `weekStart` int 0–6 (default from the plan at confirm time, then user-owned), `appearance` (`SYSTEM`, `LIGHT`, `DARK`), `displayName`, `goal`, `restrictions` text[] (normalized parsing copies; the originals are shown from `restrictionsOriginal` text[]), `aiNoticePlanShownAt`, `aiNoticeMealTextShownAt`, `aiNoticePhotoShownAt`. Values are stored in metric.

### Plan

**Plan**: `userId` unique, `status` (`NONE`, `DRAFT_PENDING`, `ACTIVE`), `structure` (`SAME_EVERY_DAY`, `BY_WEEKDAY`, `TARGETS_ONLY`), `name`, `sourceNote`, `sourceLanguage`, `sourceText` (verbatim, up to 20,000 chars; the confirmed plan's text), `draftSourceText` nullable (the pending import's text, copied to `sourceText` at confirm), `draftId` nullable (regenerated by every `startImport`/`startManual`/`startEdit`; the import job's finalize is conditional on it), `confirmedAt` nullable, `draftJson` nullable, `draftKind` (`IMPORT`, `MANUAL`, `EDIT`) nullable.

One row per user. The active plan is the slot, option, item, target, and note rows below. A pending import, a manual setup in progress, or an edit in progress lives entirely in `draftJson` (the same shape the import job returns) until the user confirms; confirming applies the draft to the rows in one transaction and clears `draftJson`. The user can log meals against the active rows while a draft is pending. Deleting the plan deletes the rows and sets `status = NONE`.

**PlanSlot**: `planId`, `weekday` int not null (`0`–`6`, or `7` for same-every-day and targets-only, so the unique key never contains a null), `position` int, `originalName`, `englishLabel`, `timeStart`, `timeEnd` time nullable, `sourceExcerpt`. Unique `(planId, weekday, position)`.

**PlanOption**: `planSlotId`, `position`, `label` nullable. A single-meal slot has exactly one option; the UI hides the concept when the count is 1.

**PlanItem**: `planOptionId`, `position`, `originalName`, `englishLabel`, `quantity` nullable, `unit` nullable (unit-table key: a measure, never a food or a size), `unitGrams` nullable (grams of one unit when `unit` is a count unit; decision 024), `quantityAssumed` bool, `assumedDefaultKey` nullable, `preparationNote` nullable, `alternatives` JSON `[{originalName, englishLabel, nutrition}]`, `category` enum (`OIL`, `BREAD`, `RICE`, `POTATO`, `NUTS`, `DAIRY`, `MEAT`, `VEGETABLE`, `HERB`, `CONDIMENT`, `FRUIT`, `OTHER`), `nutrition` JSON (section 5.1), `sourceExcerpt`.

**PlanTarget**: `planId`, `planSlotId` nullable (null means daily), `weekday` int nullable, `nutrient` enum (`ENERGY_KCAL`, `PROTEIN_G`, `CARB_G`, `FAT_G`, `FIBER_G`, `SODIUM_MG`), `type` (`RANGE`, `MINIMUM`, `MAXIMUM`, `DESIRED`, `APPROXIMATE`), `low` decimal nullable, `high` decimal nullable, `source` (`EXPLICIT`, `ESTIMATED`, `SUM_OF_MEALS`), `sourceExcerpt` nullable. Validation: `RANGE` needs both bounds with `low <= high`; `MINIMUM` needs `low`; `MAXIMUM` needs `high`; `DESIRED` and `APPROXIMATE` need `low` only. Unique `(planId, scopeKey)` where `scopeKey` is the non-null string `weekday:planSlotId-or-day:nutrient` derived by the service (nullable columns never take part in a unique key).

**PlanNote**: `planId`, `originalText`, `reason` (`TRAINING_CONDITIONAL`, `EXERCISE`, `FASTING`, `DAY_TYPE`, `UNSUPPORTED_SCHEDULE`, `OTHER`). Every plan instruction that is not a meal, target or schedule is a note, verbatim and never evaluated; there is no rule model (decision 023).

**PlanImportJob**: `userId`, `status` (`QUEUED`, `RUNNING`, `DONE`, `FAILED`, `CANCELLED`), `attempt` int, `heartbeatAt` nullable, `startedAt`, `finishedAt`, `errorCategory` nullable, `draftId` (the `Plan.draftId` it was started for). The source text is on `Plan.draftSourceText`; the result goes to `Plan.draftJson` only while `Plan.draftId` still equals the job's `draftId`.

Applying a draft to rows: an edit draft (`startEdit`) carries the existing row ids of every slot, option and item; at confirm, rows with an id are updated in place, rows without one are inserted, and active rows absent from the draft are deleted. `position` is display order only, so removing or reordering options never re-links a meal to a different option. Import and manual drafts carry no ids and replace the rows. A slot that no longer exists after confirm has its links set to `planSlotId = null` ("Other") and its skipped-slot rows deleted. A slot whose options changed keeps its links but the link's `planOptionId` is set to null when that option no longer exists, which makes the row "Needs review · Choose option". Before confirm, the review screen states how many past linked meals are affected.

### Day

**DayRecord**: `userId`, `localDate` date, `timeZone` (the app zone when the row was created, decision 022), `logComplete` bool default true. Unique `(userId, localDate)`. Created lazily on the first meal, skip, or completeness change for that date; viewing a day does not create a row.

**DaySkippedSlot**: `dayRecordId`, `planSlotId`. Unique pair. A slot cannot be marked skipped while a meal is linked to it on that day; the action returns `SLOT_HAS_MEAL`.

### Meal

**Meal**: `userId`, `dayRecordId`, `consumedLocalTime` time nullable (`null` means time unknown), `inputKind` (`TEXT`, `PHOTO`, `PHOTO_TEXT`, `RECENT`, `PLANNED`, `MANUAL`), `originalText` nullable (verbatim), `notes` nullable, `revision` int, `copiedFromMealId` nullable, `clientRequestId` text unique, `planSlotId` nullable (null means "Other"), `planOptionId` nullable, `linkConfirmedByUser` bool.

The meal's date is `DayRecord.localDate`; its zone is `DayRecord.timeZone`. The composer decides the date (default today; "Was this for yesterday?" between 00:00 and 04:00; the chosen date on a History page). A cross-midnight window is not modeled separately: the meal belongs wholly to the date the user chose, for both slot comparison and nutrition. This is a deliberate simplification of product spec section 8 and is listed in section 22.

**FoodItem**: `mealId`, `position`, `originalName`, `englishLabel`, `quantity` nullable, `unit` nullable, `unitGrams` nullable (decision 024), `quantityUnknown` bool, `quantityAssumed` bool, `preparation` nullable, `category` enum, `alternatives` JSON, `matchedPlanItemId` nullable, `isAddedItem` bool, `restrictionHit` text nullable, `nutrition` JSON (section 5.1).

**Upload**: `userId`, `mealId` nullable, `position` int nullable, `storageKey`, `bytes`, `width`, `height`, `sha256`, `status` (`STAGED`, `ATTACHED`, `REMOVED`), `expiresAt` (24 h while `STAGED`). One table for staged and attached photos.

**MealDraft**: `userId`, `clientRequestId` unique, `revision` int, `state` JSON (input kind, text, upload ids, date, time, slot, option, answers, review edits), `analysisRunId` nullable, `analysisStartedRevision` int nullable, `analysisResult` JSON nullable (validated), `analysisStatus` (`NONE`, `RUNNING`, `DONE`, `FAILED`), `expiresAt` (24 h from last edit). A result is persisted only by a conditional update on `(analysisRunId, revision = analysisStartedRevision)`. A draft and its staged uploads expire together.

### Reflection

**MorningMessage**: `userId`, `localDate`, `status` (`GENERATING`, `READY`), `paragraph` text nullable, `isFallback` bool, `fallbackState` enum nullable, `factsSnapshot` JSON, `factsHash`, `usedFactIds` text[], `generatedAt` nullable, `claimedAt`, `providerModel` nullable, `stale` bool, `collapsed` bool. Unique `(userId, localDate)`. Regeneration overwrites in place. No revision history.

### Operational

**AiCall**: `userId` nullable, `kind` (`PLAN_IMPORT`, `PLAN_BASELINE`, `MEAL_TEXT`, `MEAL_PHOTO`, `REFLECTION`), `providerModel`, `inputRevision`, `durationMs`, `promptTokens`, `completionTokens`, `outcome` (`PENDING`, `OK`, `INVALID_JSON`, `SCHEMA_REJECTED`, `TIMEOUT`, `PROVIDER_ERROR`, `RATE_LIMITED`), `attemptsJson` (per-attempt model, duration, outcome), `createdAt`. One row per user operation, inserted as `PENDING` at admission and updated at the end. No bodies. Pruned after 90 days.

**AnalyticsEvent**: `userId` nullable, `name` from the product spec section 16 list, `properties` JSON (operational metadata only), `createdAt`. Pruned after 90 days.

**FoodDataCache**: `queryKey` unique, `result` JSON, `fetchedAt`. USDA responses, 30 days.

**JobLock**: `name` unique, `holder` text nullable, `lockedUntil` timestamptz. Section 12.

### 5.1 Nutrition JSON shape

Stored on `PlanItem.nutrition`, `FoodItem.nutrition`, and inside `alternatives`:

```
{
  "basis": "PER_RECORDED_PORTION" | "PER_100G",
  "basisQuantity": 80, "basisUnit": "g",
  "values": { "ENERGY_KCAL": 210, "PROTEIN_G": 7.1, "CARB_G": null, ... },
  "source": "AI_ESTIMATE" | "USDA" | "USER_LABEL" | "RECIPE",
  "sourceRef": "usda:2345678@2025-04",
  "isEstimate": true,
  "userOverride": false
}
```

Scaling rules, implemented in `services/food-data/scale.ts`:

- `PER_100G` values scale linearly to the recorded quantity after unit conversion (a count unit converts through the item's `unitGrams`); conversion is refused when the pair has no path, and the nutrient shows "Not evaluated".
- `PER_RECORDED_PORTION` values scale linearly when only `quantity` changes (2 pieces → 3 pieces) and the source is `AI_ESTIMATE` or `RECIPE`. A change of unit or of the grams per unit scales through grams when both portions weigh something ("2 ×" of 50 g each → 150 g). The result stays `isEstimate: true`.
- A change of identity or preparation, or a unit change with no conversion path, requires re-estimation; the review shows the previous values struck through until the user confirms. Grams per unit entered where none were known keep the values and show "Check this value".
- `userOverride: true` values never scale. If the user later changes the quantity, the value is kept and the row shows "Check this value".
- `null` stays `null`. Subtotals that include a `null` are labeled incomplete.

Plan baseline: computed per option, never summed across options of a slot. Daily `ESTIMATED` targets are the sum over one option per slot, using the first option, and are labeled "Estimated from your plan"; explicit targets take precedence per nutrient. An item with alternatives stores the nutrition of the first alternative on the item and the others inside `alternatives`. The baseline is part of the draft and is reviewed on screen 7b before confirm (product spec section 6): the import job estimates it; for manual and edit drafts `estimateDraftBaselineAction` estimates items with missing or changed nutrition when the user reaches 7b. Confirm applies the draft atomically and makes no AI call. `SUM_OF_MEALS` is the arithmetic sum of explicit per-meal ranges and is created only when every slot has one and no daily figure was given.

### Indexes beyond foreign keys

`Meal (userId, dayRecordId)`, `Meal (userId, createdAt DESC)`, `Meal (planSlotId)`, `DayRecord (userId, localDate)` unique, `Upload (status, expiresAt)`, `PlanImportJob (status, heartbeatAt)`, `AiCall (userId, kind, createdAt)`, `User (deletionScheduledFor) WHERE deletionScheduledFor IS NOT NULL`, `MealDraft (expiresAt)`.

## 6. Domain logic — Added

All calculations are pure functions in `lib/rubric` and `lib/time` over plain objects, called by `services/day.service.ts`. There is no comparison cache. A day view computes its comparison on read from the meals, skipped slots, completeness flag, the current plan, `now`, and `RUBRIC_VERSION`. The view model carries the rubric version, coverage, and the contributing meal ids and revisions, which satisfies product spec section 8's traceability without storing a derived score. History computes seven days on read; at fewer than twenty meals a day this is milliseconds.

### Calculation order for one day

1. Load the `DayRecord` (or treat the date as empty), its meals with food items, its skipped slots, and the plan slots for that weekday.
2. Determine `dayPhase`: `ONGOING` if `localDate` is today in the day's zone, else `PAST`. `now` is an explicit input, so midnight changes the result without any write.
3. Group meals by `planSlotId`. Meals with `null` go to "Other".
4. For each plan slot: if any linked meal exists, the slot is `RECORDED`; else if a skipped row exists, `SKIPPED`; else `NOT_RECORDED`. A `RECORDED` slot whose linked meals lack a `planOptionId` (multi-option slot) or whose linked meals name different options is `NEEDS_REVIEW` with the resolving action "Choose option".
5. For each `RECORDED` slot with a resolved option: combine the food items of all linked meals, then run `matchSlot`, `portionResult`, and `orderOrTimingResult` once for the slot. The earliest linked meal's time is the slot's time. Coverage counts slots, never meals.
6. `scoreSlot` and `scoreDay` per the rubric. The nutrition component is included only when `dayPhase = PAST`, `logComplete = true`, and the energy subtotal is complete.
7. Nutrition subtotals sum every meal once, including "Other".

| Function                                                                                                 | Spec source                         |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `localDateFor(instant, zone)`, `dayBounds(localDate, zone)`, `isLateNightWindow(now, zone)`              | section 14, section 7               |
| `matchSlot(combinedItems, option)` → `{status, reason, missing[], added[], mixed}`                       | section 8 matching                  |
| `portionResult(combinedItems, option)` → per-item bands and the mean                                     | 15% and 30%, inclusive              |
| `energyResult(subtotal, target)` → band and signed difference                                            | 10%, inclusive                      |
| `timeResult(slotTime, window)` and `orderResult(slotsOfDay, plannedOrder)`                               | 60 and 120 minutes; order rule      |
| `scoreSlot(components)` → `{score, weightsUsed, excluded[]}`                                             | 50/30/20 with exclusion             |
| `scoreDay(slotScores, nutritionComponent)` → `{dayScore, showNumber, band, coverage, completeByDefault}` | 90/10, normalization, two-meal rule |
| `nutritionSubtotals(meals)` → per nutrient `{value, complete}`                                           | unknown never zero                  |
| `compareTarget(subtotal, target, dayPhase, logComplete)`                                                 | section 8 target table              |
| `restrictionHits(items, restrictions)` → item names matched by normalized token                          | section 7 reminder                  |
| `reflectionFacts(dayView, plan, profile)` → `[{id, kind, text}]`                                         | section 11 inputs                   |
| `isReflectionStale(snapshotFacts, currentFacts, usedFactIds)` → bool                                     | staleness rule                      |
| `sevenDaySummary(dayViews)` → sentence key and denominators                                              | section 10                          |

Historical days use `DayRecord.timeZone`, not the current app zone. A plan edit changes past comparisons by design (section 0.1); the confirm screen says "Past days will be compared against the updated plan."

Fixtures under `src/__tests__/fixtures/` cover both reference plans and every worked example in product spec section 8. Section 22 flags the three examples in the product spec that are internally inconsistent; fixtures encode the rule text, not the flawed example.

## 7. API contract — Added

Server actions return `ActionResult<T>`, authorize first, parse with zod, check ownership in the service, and revalidate. Inputs are `unknown`. Every mutation of a versioned row (`Meal`, `MealDraft`) takes `expectedRevision` and returns `CONFLICT` with the current row when it does not match.

### Account, profile, onboarding

| Action                                           | Auth                             | Input              | Result                                 | Notes                                                                                |
| ------------------------------------------------ | -------------------------------- | ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------ |
| `signUpAction`                                   | none                             | username, password | session cookie, redirect to onboarding | 10 per IP per hour (tunable); the form says a forgotten password cannot be recovered |
| `loginAction`                                    | none                             | boilerplate        |                                        | boilerplate throttle                                                                 |
| `changePasswordAction`                           | user                             | current, new       | `ok()`                                 | revokes other sessions                                                               |
| `requestAccountDeletionAction`                   | user                             | typed username     | `ok()`                                 | revokes all sessions, refuses login, cancels jobs, schedules purge in 7 days         |
| `deleteUnderageAccountAction`                    | user with `onboardingStep = AGE` |                    | `ok()`                                 | immediate purge; no Profile row exists                                               |
| `saveOnboardingStepAction`                       | user                             | step, values       | next step                              | age is validated and never stored when under 18                                      |
| `updateProfileAction`, `updatePreferencesAction` | user                             | partial            | profile                                | appearance also set in a cookie                                                      |
| `acknowledgeAiNoticeAction`                      | user                             |                    |                                        |                                                                                      |

### Plan

| Action                                            | Input                           | Result                                   | Notes                                                                                                                         |
| ------------------------------------------------- | ------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `startPlanImportAction`                           | sourceText                      | jobId                                    | stores text on `Plan.sourceText`, sets `DRAFT_PENDING`, inserts a `QUEUED` job, calls `after(runJobsNow)`                     |
| `getPlanImportStatusAction`                       |                                 | job status, whether `draftJson` is ready | polled every 3 s while pending                                                                                                |
| `retryPlanImportAction`, `cancelPlanImportAction` |                                 |                                          |                                                                                                                               |
| `startManualPlanAction`                           | structure, name                 |                                          | writes an empty draft                                                                                                         |
| `updatePlanDraftAction`                           | section, payload, draftRevision |                                          | edits `draftJson`                                                                                                             |
| `startPlanEditAction`                             |                                 |                                          | copies the active rows into `draftJson`                                                                                       |
| `confirmPlanAction`                               | draftRevision                   |                                          | applies the draft in one transaction, runs `PLAN_BASELINE` for changed items, returns the count of past linked meals affected |
| `discardPlanDraftAction`                          |                                 |                                          |                                                                                                                               |
| `deletePlanAction`                                | typed confirmation              |                                          |                                                                                                                               |

### Meal

| Action                     | Input                                                                      | Result                                         | Notes                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMealDraftAction`    | clientRequestId, kind, text?, uploadIds[], date, time?, slotId?, optionId? | draft                                          | idempotent on `clientRequestId`                                                                                                                                                                                                               |
| `analyzeMealDraftAction`   | draftId, expectedRevision                                                  | draft with `analysisResult` or a typed failure | section 10 deadline; result persisted only if `analysisInputHash` still matches the draft's input at completion                                                                                                                               |
| `updateMealDraftAction`    | draftId, expectedRevision, edits                                           | draft with rescaled totals                     | any edit to input fields changes `analysisInputHash`, so an in-flight analysis is discarded on return                                                                                                                                         |
| `saveMealAction`           | draftId, expectedRevision, clientRequestId                                 | meal                                           | refuses `OPTION_REQUIRED`, `FUTURE_TIME`; creates the meal and deletes the draft in one transaction; a repeat with the same `clientRequestId` (even after the draft is gone) returns the existing meal; saving into a skipped slot unskips it |
| `updateMealAction`         | mealId, expectedRevision, edits                                            | meal or `CONFLICT`                             |                                                                                                                                                                                                                                               |
| `deleteMealAction`         | mealId, expectedRevision                                                   |                                                |                                                                                                                                                                                                                                               |
| `setMealLinkAction`        | mealId, expectedRevision, slotId or null, optionId                         | meal                                           | validates the option belongs to the slot and the slot to the meal's weekday                                                                                                                                                                   |
| `reuseMealAction`          | mealId                                                                     | new draft                                      |                                                                                                                                                                                                                                               |
| `removeMealPhotoAction`    | uploadId                                                                   |                                                | sets `REMOVED`, deletes the object                                                                                                                                                                                                            |
| `markSlotSkippedAction`    | localDate, slotId, skipped                                                 |                                                | `SLOT_HAS_MEAL` when a meal is linked                                                                                                                                                                                                         |
| `setDayCompletenessAction` | localDate, complete                                                        |                                                |                                                                                                                                                                                                                                               |

### Reflection and history

| Action                              | Input                | Result                        | Notes                                                                                                                          |
| ----------------------------------- | -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `getMorningMessageAction`           | localDate            | `{status, paragraph?, stale}` | section 10.3 claim protocol; client polls every 2 s while `GENERATING`, up to 25 s (past the 20 s takeover), then offers Retry |
| `updateReflectionAction`            | localDate            |                               | regenerates in place; the previous paragraph is not kept                                                                       |
| `setReflectionCollapsedAction`      | localDate, collapsed |                               |                                                                                                                                |
| `getDayAction`, `getSevenDayAction` | date                 | view models                   | computed on read                                                                                                               |

### Route handlers

| Route                      | Method                | Auth                   | Contract                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/live`                | GET                   | none                   | returns 200 with no dependencies; liveness only                                                                                                                                                                                                                                                                                   |
| `/api/health`              | GET                   | none                   | database `SELECT 1` through the pooler with a 3 s timeout; readiness                                                                                                                                                                                                                                                              |
| `/api/uploads`             | POST multipart `file` | user, `Origin` checked | accepts JPEG, PNG, WebP by magic bytes; rejects HEIC with `415`; 10 MB limit; at most 2 concurrent decodes per process (semaphore); sharp with `limitInputPixels: 40e6`, re-encode JPEG quality 82, max edge 2048, metadata stripped; writes `{prefix}uploads/{userId}/{uploadId}.jpg`; returns `{uploadId, width, height}`       |
| `/api/uploads/[id]`        | DELETE                | owner                  | staged only                                                                                                                                                                                                                                                                                                                       |
| `/api/photos/[id]?s=<tag>` | GET                   | owner                  | `tag` is the first 12 hex chars of the SHA-256 of the session token; the handler verifies it matches the current session, then streams with `Cache-Control: private, max-age=86400`. Because the tag is part of the URL, another account on the same browser cannot hit the cached entry, and logout invalidates every cached URL |
| `/api/export`              | GET                   | user                   | streams `dietyaar-export-{date}.zip`: `profile.json`, `plan.json`, `meals.json`, `messages.json`, `photos/`                                                                                                                                                                                                                       |

`/api/*` is outside the proxy matcher; each handler calls `requireAuth()` itself.

### Error codes

`USERNAME_TAKEN`, `PASSWORD_COMMON`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `UNDER_18`, `PLAN_TEXT_TOO_LONG`, `OPTION_REQUIRED`, `FUTURE_TIME`, `SLOT_HAS_MEAL`, `CONFLICT`, `AI_UNAVAILABLE`, `AI_TIMEOUT`, `PHOTO_DISABLED`, `UPLOAD_TYPE`, `UPLOAD_SIZE`, `STORAGE_FULL`, `DAILY_AI_CAP`, `NOT_FOUND`.

## 8. Auth and security — Extended

Inherited: cookie sessions with SHA-256 hashed tokens, bcrypt 12 rounds, per-username login throttle, `server-only` boundaries, validated env, security headers, `SKIP_AUTH` refused in production.

- **Sign-up.** Username 3–30 chars, `[A-Za-z0-9_]`, unique case-insensitively via `citext`. Password 8 to 64 characters and at most 72 UTF-8 bytes (bcrypt's input limit; longer input is rejected, never truncated), rejected if it exactly matches the bundled top-10k common-password list.
- **No password recovery.** No form, no token, no email. Sign-up and Settings each state this in one line.
- **Password change** revokes all sessions except the current one.
- **Ownership.** Every service function takes `ownerId` first and includes it in the `where` of the root row; child rows are reached only through their parent. A missing or foreign row throws `NOT_FOUND`.
- **Session lifetime.** 90 days (tunable) from creation, matching "sessions persist until logout". No sliding refresh in V1.
- **Rate limits.** In-process sliding windows: sign-up 10 per IP per hour using `X-Real-Ip`; uploads 60 per user per hour; AI per section 10.
- **Under-18 stop.** Age is validated at the `AGE` step; under 18 stops with no Profile row and offers one-tap deletion.
- **CSRF.** Server actions are same-origin by construction. Route handlers that mutate check `Origin` against `APP_URL`.
- **CSP.** `default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`. Sentry events go through the SDK's tunnel route (`/monitoring`) so the browser never contacts the Sentry host and the policy needs no build-time host.
- **Supabase surface.** The Data API is disabled in the project settings, the `anon` and `service_role` keys are never placed in the app, and the app connects as a dedicated role `dietyaar_app` with table privileges only; migrations run as `postgres` through `directUrl`. Setup step 1 verifies that an anonymous REST call to the project returns an error.
- **Prompt injection.** User text appears only in the `user` message under a fixed system prompt that declares it data. Responses are zod-validated, unknown fields dropped, tool calling never enabled. Every `sourceExcerpt` the model returns is checked to be a substring of `sourceText`; otherwise it is replaced with an empty excerpt.

## 9. Locale, time, and text — Extended

Inherited: `en` profile, `t()` dictionary, `format` helpers, logical CSS utilities, `<Ltr>` and `bidi-plaintext`, `dir="auto"` inputs.

- **Time zone is one app constant** (decision 022, supersedes 009): `APP_TIME_ZONE` (`Asia/Dubai`, `lib/time/zone.ts`) for today; `DayRecord.timeZone` for stored days. The `lib/time` functions keep their `zone` parameter; the profile constant is never read (section 4 rule 4).
- **Week start is per user** from `Profile.weekStart`, seeded from the plan's first listed weekday at confirm time, else Saturday.
- **Original text is stored verbatim.** `originalText`, `originalName`, `sourceText`, `restrictionsOriginal` are never normalized. A parsing copy produced by `lib/text/normalize.ts` (Persian and Arabic digits to Western; Arabic yeh and kaf to Persian forms; whitespace collapse) is used for numeric fields, restriction matching, and the text sent to the AI. The boilerplate's `lib/persian.ts` is restored after setup and becomes `lib/text/normalize.ts`.
- **Right-to-left runs.** The `Original + English name label` component wraps the original in `<bdi>` and the English label in an LTR span. It is the only place mixed-direction text is composed.
- **Fonts.** System stack. Persian and Arabic glyph rendering on iOS Safari and Android Chrome is a design-review check.
- **RTL lint.** A reduced check forbids `text-left` and `text-right` inside `components/product/**`.

## 10. AI integration — Added

### 10.1 Adapter

`services/ai/deepseek.ts` exposes `complete({ kind, system, user, images?, schema, deadline, maxTokens, userTag })`. It builds an OpenAI-compatible request to `https://api.deepseek.com/chat/completions` with `response_format: { type: 'json_object' }` (the prompt contains the word "json" and one example, as DeepSeek requires), `stream: false`, `user_id: userTag`, and the model from env. It sends with an `AbortSignal` derived from `deadline`, retries once on network error or 5xx only if at least 40 percent of the deadline remains, and returns `{ ok: true, data, usage, model, durationMs, attempts }` or `{ ok: false, reason, attempts }` where `attempts` lists every provider attempt's outcome and duration with reason in `TIMEOUT | INVALID_JSON | SCHEMA_REJECTED | PROVIDER_ERROR | RATE_LIMITED`. Empty content, which DeepSeek documents as an occasional behavior, is `INVALID_JSON`. The adapter does not persist anything; the calling service writes one `AiCall` row per attempt.

Models: `AI_MODEL_TEXT` and `AI_MODEL_VISION`, both default `deepseek-flash` (verified September 16, 2026 as the current name with image input and JSON mode). Thinking mode is turned off for every call with `thinking: { type: 'disabled' }` in the request body (DeepSeek's documented toggle for its reasoning-capable models); setup step 2 confirms the field against the live API and the runbook records any correction. The base URL is `DEEPSEEK_API_BASE_URL` (default `https://api.deepseek.com`) so e2e can point at a stub server. Images go base64-inline in the `user` message.

### 10.2 Calls and deadlines

One deadline per user-visible operation, shared by every stage and retry inside it.

| Operation       | Deadline    | Stages                                                                                                                                                       | Profile fields sent      |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Plan import job | 120 s total | `PLAN_IMPORT` per weekday chunk for `BY_WEEKDAY` (up to 7 calls, each with the remaining budget divided by remaining chunks), then `PLAN_BASELINE` per chunk | age, sex, height, weight |
| Meal analysis   | 45 s total  | one `MEAL_TEXT` or `MEAL_PHOTO` call; at 15 s the UI shows the calm status and the manual option                                                             | none                     |
| Reflection      | 15 s total  | one `REFLECTION` call; on failure the deterministic fallback is written                                                                                      | age, sex, height, weight |

Output schemas (zod) are the same as version 1.1: import returns slots, options, items, targets, notes, and uncertainties per chunk; meal analysis returns items with nutrition, a suggested slot and option, and grouped questions; reflection returns `{ paragraph, usedFactIds[] }`. Every `usedFactId` must exist in the supplied fact list or the response is `SCHEMA_REJECTED` and the fallback is used. The paragraph must be 40 to 110 words.

### 10.3 Reflection claim protocol

1. `getMorningMessageAction` runs `INSERT (userId, localDate, status='GENERATING', claimedAt=now(), factsSnapshot, factsHash) ON CONFLICT DO NOTHING RETURNING id`.
2. If a row was returned, this request owns generation: it calls the adapter with the 15 s deadline and then updates the row to `READY` with the paragraph or the fallback. The update is conditional on `status = 'GENERATING' AND claimedAt = <its claimedAt>`.
3. If no row was returned, the request reads the row. `READY` returns the paragraph. `GENERATING` with `claimedAt` newer than 20 s returns `GENERATING` and the client polls. `GENERATING` older than 20 s means the owner died: the request writes the fallback with the same conditional update and returns it.
4. `updateReflectionAction` sets `status = 'GENERATING'` with a new `claimedAt` and repeats step 2.

### 10.4 Caps and cost

Per user per local day (tunable), counted as **user operations** (one meal analysis, one plan import regardless of its chunk and baseline calls, one reflection update): 30 meal analyses, 6 plan imports, 3 reflection updates. Admission is atomic: the `AiCall` row is inserted as `PENDING` under a lock on the user row after counting the day's operations of that kind. Global: `AI_DAILY_TOKEN_BUDGET` (default 5 million) as a soft cap on completed tokens plus 8k reserved per `PENDING` row; at 90 percent, new operations return `AI_UNAVAILABLE` and the composer offers manual entry. At DeepSeek's September 2026 `deepseek-flash` prices a meal analysis costs well under one cent.

### 10.5 Evaluation harness

`npm run ai:eval` runs the fixture set (both reference plans, 40 Persian meal descriptions with reviewer-written expected items, 20 photos when photo work starts, every reflection state with expected fact usage) against the live provider. It reports schema pass rate, expected-item recall, unit resolution rate, unsupported-fact rate (a used fact id not in the input, or a number in the paragraph not present in any fact), p50, p75, and p95 latency, and token cost. Release thresholds are section 19 item 4. The harness is not part of CI.

### 10.6 USDA lookup

`services/food-data/usda.ts` queries FoodData Central `foods/search` for `Foundation` and `SR Legacy` data only, so it covers generic ingredients such as eggs, rice, and chicken breast. Packaged-product values come from the user entering label values, not from USDA. Results are cached in `FoodDataCache` for 30 days. Enabled by `USDA_LOOKUP_ENABLED=true` only after setup step 2 confirms egress.

## 11. Photo pipeline — Added

1. **Device.** Accept JPEG, PNG, WebP, HEIC, HEIF. HEIC and HEIF are converted with `heic-to`; everything is downscaled with a canvas to a 1280 px maximum edge at JPEG quality 0.8 (typical result 120 to 250 KB). Capacity: at the section 17 workload (≈ 333 photos a day) the 1 GB free bucket lasts about two weeks, so photo logging on the free tier is a pilot of at most ~30 users; the full workload needs the storage upgrade (section 19 item 10).
2. **Upload.** `POST /api/uploads` per section 7. `Upload` row `STAGED`, 24 h expiry.
3. **Analysis.** The service reads the staged objects and sends them base64-inline. Nothing is uploaded to the provider.
4. **Save.** `saveMealAction` sets the rows to `ATTACHED` with `mealId` and `position`.
5. **Removal.** `REMOVED`, object deleted, food record kept.
6. **Cleanup.** Hourly: `STAGED` past expiry, and drafts past expiry with their uploads.
7. **Viewing.** `GET /api/photos/[id]?s=<tag>` per section 7.

Bucket: one private Supabase Storage bucket `dietyaar`, server-side S3 keys only, prefix `prod/` or `staging/`. Usage is tracked by the app as the sum of `Upload.bytes` where `status != REMOVED`; uploads return `STORAGE_FULL` above `STORAGE_SOFT_LIMIT_BYTES` (default 700 MB, tunable). Backups do not live in this bucket (section 12).

The Darkube ingress body limit is unknown; setup step 3 measures it. Device-side downscaling keeps real uploads under 1 MB regardless.

## 12. Background work — Added

Darkube has no CronJob. The scheduler runs in-process.

### Lease and heartbeat

`src/instrumentation.ts` starts `services/jobs/scheduler.ts` when `SCHEDULER_ENABLED=true`. Each process has a random `holder` id. Every 20 s it runs:

```sql
UPDATE "JobLock" SET holder = $1, lockedUntil = now() + interval '60 seconds'
WHERE name = 'scheduler' AND (lockedUntil < now() OR holder = $1)
```

A row count of 1 means this process holds the lease for the next 60 s. The heartbeat timer is independent of task execution, so a task that runs for minutes keeps the lease as long as the process is alive. If the heartbeat ever fails to renew (row count 0), running tasks are asked to stop at their next checkpoint and the process stops scheduling until it wins again. This works through the transaction pooler, survives rolling updates, and needs no session state.

### Tasks

| Task                   | Cadence                                                                                   | Work and recovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runPlanImportJobs`    | every 10 s while `QUEUED` or reclaimable jobs exist, plus `after()` from the start action | Claim (atomic under concurrent runners, since `after()` and the scheduler may both run it): `UPDATE plan_import_jobs SET status='RUNNING', attempt=attempt+1, "heartbeatAt"=now(), "startedAt"=now() WHERE id = (SELECT id FROM plan_import_jobs WHERE status='QUEUED' OR (status='RUNNING' AND "heartbeatAt" < now() - interval '3 minutes') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED) AND status IN ('QUEUED','RUNNING') RETURNING id, attempt, "draftId"` through `$queryRaw` (table names are the snake_case `@@map` names). No transaction is held during the AI calls; `heartbeatAt` is updated every 20 s by the task. Finalize, in one transaction: `UPDATE plan_import_jobs SET status='DONE', … WHERE id=$1 AND attempt=$2 AND status='RUNNING'`, and only if that affected one row, `UPDATE plans SET "draftJson"=$3 WHERE "userId"=$4 AND "draftId"=$5`. An obsolete attempt, or a job whose draft the user has since replaced, therefore cannot commit. After 3 failed attempts the job is `FAILED` and Today shows "We couldn't prepare your plan". |
| `cleanupStagedUploads` | hourly                                                                                    | delete expired `STAGED` uploads and expired drafts (object first, then row)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `purgeDeletedAccounts` | hourly                                                                                    | for users past `deletionScheduledFor`: delete objects under the user's prefix in the photo bucket and their `photos/{key}` copies in the backup bucket, then the `User` row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pruneOperational`     | daily                                                                                     | `AiCall` and `AnalyticsEvent` older than 90 days; `FoodDataCache` older than 30 days                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `backupToHamravesh`    | daily at 03:00 UTC                                                                        | First copy every `ATTACHED` upload object whose key is not yet in the backup bucket to `photos/{key}`; then `pg_dump --format=custom` against `DIRECT_DATABASE_URL`, gzip, encrypt with `openssl enc -aes-256-cbc -pbkdf2` and `BACKUP_ENCRYPTION_KEY`, upload as `db/{date}.dump.gz.enc`; delete dumps older than `BACKUP_RETENTION_DAYS` (default 30) but always keep the newest; log bytes and duration; alert on failure through the section 16 metric                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Tasks check a `shouldStop` flag between units of work and never run more than 10 minutes.

At more than one replica nothing changes here. The login throttle and rate limits must then move to a `RateLimitBucket` table; this is decision 010.

## 13. Deployment — Replaced

### Image

Boilerplate Dockerfile with: `hub.hamdocker.ir/library/node:lts-slim` in every stage; `ENV TZ=UTC`; `postgresql-client` from the PostgreSQL apt repository at the Supabase server's major version, for `pg_dump`; `sharp` prebuilt; image tag is the short git SHA.

### Pipeline

GitHub Actions extending the boilerplate `ci.yml`: `quality` (lint, typecheck, unit tests, build), `integration` (real Postgres service, section 15), `e2e` (Playwright against a stub AI server), and on `main` only `docker`: build, push to `registry.hamdocker.ir/<org>/dietyaar:<sha>`, then `darkube deploy --ref main --token $DARKUBE_DEPLOY_TOKEN --app-id $DARKUBE_APP_ID --image-tag <sha> --job-id $GITHUB_RUN_ID`. Darkube's Git-repo build type is not used: CI must test before an image exists, and the free build quota is 100 hours per month with a 2 GB memory cap.

### Darkube app

| Setting                            | Value                                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App type                           | Docker image from `registry.hamdocker.ir/<org>/dietyaar`                                                                                                                                                                               |
| Port                               | `3000`, name `http`                                                                                                                                                                                                                    |
| Command                            | default (`docker-entrypoint.sh`: `prisma migrate deploy` then `node server.js`)                                                                                                                                                        |
| Readiness probe (general settings) | `/api/health`                                                                                                                                                                                                                          |
| Plan                               | 1000 millicore, 1024 MB, 1 replica (tunable)                                                                                                                                                                                           |
| Disk                               | none                                                                                                                                                                                                                                   |
| Custom config                      | `strategy.rollingUpdate {maxSurge: 1, maxUnavailable: 0}`; `readinessProbe httpGet /api/health, initialDelaySeconds 10, periodSeconds 10, failureThreshold 3`; `livenessProbe httpGet /api/live, periodSeconds 20, failureThreshold 3` |
| Domain                             | `<name>.darkube.app`, HTTPS redirect on; custom domain later via CNAME                                                                                                                                                                 |
| Env                                | section 14, secrets as secret envs                                                                                                                                                                                                     |
| Logs                               | Loki from stdout                                                                                                                                                                                                                       |
| Errors                             | Hamravesh Sentry, `tracesSampleRate 0.05`, `beforeSend` drops request bodies and any field named `text`, `description`, `paragraph`, `originalName`, `originalText`, `sourceText`, `notes`                                             |

### Database: Supabase Postgres, free tier

One project in the region chosen by section 19 item 1. Only Postgres is used; the Data API is disabled (section 8).

| Purpose               | Host and port                             | Mode                  | Prisma field                                          |
| --------------------- | ----------------------------------------- | --------------------- | ----------------------------------------------------- |
| Application           | `aws-0-<region>.pooler.supabase.com:6543` | Supavisor transaction | `url`, `?pgbouncer=true&connection_limit=5` (tunable) |
| Migrations, `pg_dump` | `aws-0-<region>.pooler.supabase.com:5432` | Supavisor session     | `directUrl`                                           |

The direct host is IPv6-only on the free tier and Darkube egress is IPv4, so it is never used. Transaction mode forbids prepared statements, session advisory locks, `LISTEN/NOTIFY`, and temp tables; nothing here uses them.

Migrations run at container start. Each migration file begins with `SET lock_timeout = '5s';` so a migration that cannot get its lock fails fast and the rollout stops with the old pod still serving. Migrations are backward compatible with the previous release: add nullable, backfill, tighten later. Before any destructive migration, run `npm run db:backup` and confirm the object exists.

Free-tier sizing: the largest tables are `FoodItem` and `AiCall`; at roughly 1 KB per food item and 20 items per day per user, 500 MB is about 25,000 user-days. A daily log line records `pg_database_size()`; section 19 item 10 sets the upgrade trigger. The scheduler heartbeat is continuous activity, so the 7-day pause does not trigger while deployed.

### Storage

Supabase Storage through `https://<ref>.storage.supabase.co/storage/v1/s3`, `forcePathStyle: true`, bucket `dietyaar`, private. Hamravesh Object Storage through its S3 endpoint, bucket `dietyaar-backup`, private, key with read, write, list, configured as the second target of the same adapter. Backups are therefore in Iran and independent of the Supabase account.

### Setup checklist, run once, results recorded in `docs/runbook.md`

1. Create the Supabase project; disable the Data API; create role `dietyaar_app`; create bucket `dietyaar` and S3 keys; enable `citext`, `pgcrypto`. Verify an anonymous REST call to the project is rejected. Create the Hamravesh backup bucket and key, the Darkube namespace, Sentry project, and web app.
2. From the web app's terminal on Darkube, before any product code: `psql "$DIRECT_DATABASE_URL" -c 'select 1'` and the same through `$DATABASE_URL`, recording round-trip time over 20 runs; an S3 `ListObjects` against both buckets; `curl` to `https://api.deepseek.com/models` with the key; `curl` to the USDA search endpoint; confirm the DeepSeek request field that disables thinking; send a request that sleeps 50 s through the public domain to measure the ingress timeout. If Supabase is unreachable, stop and apply section 19 item 2.
3. Upload a 10 MB file to `/api/uploads` through the public domain and record the ingress body limit.
4. Run the AI evaluation harness on the deployment account; archive the report.
5. Run `npm run db:backup`; restore the dump into the second free Supabase project and point a local app at it; sign in as a test user, open the plan, open a photo restored from the backup bucket, and confirm a day's totals match. Record the time this took.
6. Confirm `/api/health` and `/api/live` return 200 and Loki shows the startup line.

## 14. Configuration — Extended

Validated in `src/lib/env.ts`. Boilerplate variables stay.

| Variable                                                                                                               | Required                       | Notes                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `APP_URL`                                                                                                              | yes                            | CSRF and CSP                                                     |
| `DATABASE_URL`, `DIRECT_DATABASE_URL`                                                                                  | yes                            | section 13                                                       |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_KEY_PREFIX`                   | yes                            | Supabase Storage                                                 |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | yes in production              | Hamravesh Object Storage                                         |
| `BACKUP_ENABLED`, `BACKUP_RETENTION_DAYS`                                                                              | no, `true`, `30`               | retention by age; the newest dump is always kept                 |
| `BACKUP_ENCRYPTION_KEY`                                                                                                | yes in production              | passphrase for `openssl enc`; stored as a Darkube secret         |
| `STORAGE_SOFT_LIMIT_BYTES`                                                                                             | no, 700 MB                     |                                                                  |
| `DEEPSEEK_API_KEY`                                                                                                     | yes                            |                                                                  |
| `AI_MODEL_TEXT`, `AI_MODEL_VISION`                                                                                     | no, `deepseek-flash`           |                                                                  |
| `DEEPSEEK_API_BASE_URL`                                                                                                | no, `https://api.deepseek.com` | the e2e stub server overrides it                                 |
| `AI_DAILY_TOKEN_BUDGET`                                                                                                | no, 5,000,000                  |                                                                  |
| `PHOTO_LOGGING_ENABLED`                                                                                                | no, `false`                    | the photo flag; a Darkube env change and restart, no deploy      |
| `USDA_LOOKUP_ENABLED`, `USDA_API_KEY`                                                                                  | no, `false`                    |                                                                  |
| `SENTRY_DSN`                                                                                                           | no                             |                                                                  |
| `SCHEDULER_ENABLED`                                                                                                    | no, `true`                     | also `true` in e2e: the plan-import journeys need the job runner |
| `SESSION_MAX_AGE_DAYS`                                                                                                 | boilerplate, 90                |                                                                  |

Feature flags are environment variables, not a table.

## 15. Testing — Extended

Inherited: Vitest with `prismaMock`, Playwright with `t()` locators, coverage thresholds, CI gate.

- **Rubric and time fixtures.** Every threshold boundary, every worked example from product spec section 8 that is internally consistent (section 22), both reference plans, and the section 21 scenarios that are pure. `lib/rubric/**` and `lib/time/**` require 95 percent statement coverage.
- **Integration project** (`src/__tests__/integration/`, Vitest against a real Postgres service in CI): job claim under concurrency, lease takeover after a dead holder, reflection claim protocol, `saveMealAction` idempotency, `CONFLICT` on stale revisions, draft analysis superseded by an edit, plan confirm remapping links, migration `lock_timeout` behavior.
- **AI adapter unit tests** with mocked `fetch`: valid, invalid, empty content, schema rejection, timeout, 429, retry budget respected, late response discarded.
- **Playwright projects:** `Desktop Chrome` and `Pixel 7`. The mobile project runs journeys J1 to J13 from `design-scope.md` (J14 without the reset path) against a stub DeepSeek server.
- **Accessibility:** `@axe-core/playwright` on Today, Log meal, Check your meal, Settings, both themes; zero serious or critical.
- **Migration safety:** CI diffs the schema against the previous tag and fails on `DROP` or type changes without a decision note.

## 16. Observability — Extended

- **Logs.** pino JSON to Loki. Redaction: `*.originalText`, `*.originalName`, `*.sourceText`, `*.paragraph`, `*.notes`, `*.description`, `*.text`, `req.body`. One `requestId` per request.
- **Metrics from logs in Grafana:** AI outcome and duration by kind, upload count and bytes, storage usage, database size, save success and conflict counts, scheduler task duration and failures, backup success, reflection fallback rate.
- **Errors.** Sentry with the scrubber in section 13.
- **Analytics.** `AnalyticsEvent` with the product spec section 16 names only; a weekly SQL in the runbook.

## 17. Performance and capacity

Targets are product spec section 16. Engineering budget per operation, given a cross-border round trip `R` measured in setup step 2:

| Operation      | Query budget                                                                                            | Design         |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------- |
| Today          | 3 queries in parallel (day with meals and items, skipped slots and plan slots for the weekday, message) | one `R`        |
| Save meal      | 1 transaction: insert meal and items with `createMany`, update uploads, delete draft, upsert day        | one to two `R` |
| Analyze        | 1 read, AI call, 1 conditional write                                                                    | AI-bound       |
| History 7 days | 2 queries (days with meals and items in one range query, plan slots)                                    | one `R`        |

If `R` measured in setup exceeds 150 ms, the save path is reviewed before launch. Composer lookups (recent meals, today's slots) are cached per user in memory for 60 s.

Target workload for the first release, used for capacity statements and the section 15 integration tests: 200 active users, 5 meals per user per day, 1 photo per 3 meals, peaks at 20 concurrent users. One replica at the section 13 plan handles this; the AI provider's concurrency ceiling is far above it.

## 18. Decision records to add

| #   | Decision                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 008 | Self-service sign-up with username and password only; no recovery; the Users module stays as an ops tool     |
| 009 | Per-user time zone and week start (superseded by 022)                                                        |
| 010 | In-process scheduler under a heartbeat lease row; rate-limit stores move to a table at more than one replica |
| 011 | Photos converted and downscaled on the device; the server accepts JPEG, PNG, WebP                            |
| 012 | AI adapters return validated data and persist nothing; prompts are versioned constants                       |
| 013 | Comparisons are computed on read; no cache, no stored score; rubric changes apply to all history             |
| 014 | Darkube deployment from a CI-built image                                                                     |
| 015 | Feature flags are environment variables                                                                      |
| 016 | Supabase free tier for Postgres and Storage through the pooler; photos proxied through the app               |
| 017 | One plan per user, edited in place through a draft; no versions                                              |
| 018 | Backups go to Hamravesh Object Storage, including photos                                                     |

## 19. Owner decisions with defaults

1. **Supabase region.** Default `eu-central-1`; confirm by measured latency in setup step 2.
2. **Fallback if Supabase is unreachable or restricts the account.** Default: Darkube PostgreSQL app plus Hamravesh Object Storage for photos, using the same adapters; see appendix A.
3. **Custom domain.** Default `<name>.darkube.app`.
4. **Photo-logging release thresholds** on the evaluation set: schema pass 98 percent, expected-item recall 85 percent, unit resolution 90 percent, unsupported-fact rate under 2 percent, p75 latency 15 s.
5. **Daily AI token budget.** 5 million.
6. **Staging.** None for V1; the second free Supabase project is for restore tests.
7. **Session lifetime.** 90 days.
8. **Backup retention.** 30 days by age, newest always kept; photo copies deleted when the account is purged.
9. **Admin Users module.** Kept, `ADMIN` role, no health data access.
10. **Supabase upgrade trigger.** Database over 400 MB, storage over 700 MB, or monthly egress over 4 GB.
11. **Cross-midnight meals.** Default: the meal belongs wholly to the date the user chose. The product spec's split between slot date and nutrition date is not implemented.

## 20. Risks

| Risk                                                    | Likelihood         | Impact            | Mitigation                                                                              |
| ------------------------------------------------------- | ------------------ | ----------------- | --------------------------------------------------------------------------------------- |
| Supabase unreachable from Iran or account restricted    | Medium             | Blocks everything | Setup step 2 first; appendix A fallback; backups already off-provider                   |
| Cross-border latency inflates page and save times       | High               | Medium            | Query budgets in section 17; measured `R`; review gate                                  |
| Free-tier ceilings                                      | Medium over time   | Medium            | Pruning, soft limit, size gauge, upgrade trigger                                        |
| No provider backups                                     | Certain            | High              | Nightly dump and photo copy to Hamravesh; restore rehearsal in setup step 5             |
| Free project paused after 7 idle days                   | Low while deployed | High              | Heartbeat is activity; runbook step to unpause if replicas were zero                    |
| DeepSeek unreachable or Persian parsing below threshold | Medium             | High              | Setup step 2; evaluation harness; manual paths                                          |
| Ingress timeout below 45 s                              | Unknown            | Medium            | Measured in setup step 2; if lower, meal analysis moves to the job pattern with polling |
| Plan edit changes past comparisons unexpectedly         | Certain by design  | Low               | Confirm screen states it; decision 017                                                  |
| Migration lock blocks the old pod                       | Low                | Medium            | `lock_timeout 5s`; backward-compatible migrations                                       |

## 21. Acceptance scenarios

Each is a test in section 15; pure ones are unit fixtures, the rest integration or e2e.

1. **Plan edit re-compares history.** A user with three logged days corrects a lunch quantity and confirms. Every day's lunch portion result changes, every meal link survives, and the confirm screen said "Past days will be compared against the updated plan · 3 meals affected".
2. **Plan replace remaps by position.** Replacing a same-every-day plan with another same-every-day plan of five slots keeps links for slots 1 to 5; a sixth old slot's meals become "Other".
3. **Lunch in two sittings.** Two meals linked to lunch, same option, receive one slot score; coverage reads "1 of 5"; nutrition counts both.
4. **Different options in two sittings.** The slot shows "Needs review · Choose option" and is excluded from the score until resolved.
5. **Midnight without edits.** The same day viewed at 23:59 and 00:01 in the user's zone changes from "In progress" to a past day with the nutrition component applied.
6. **Late-night meal.** At 00:30 the composer asks "Was this for yesterday?"; choosing Yesterday links to yesterday's dinner and yesterday's totals.
7. **Import restarts once.** A `RUNNING` job whose heartbeat is 4 minutes old is reclaimed by the next tick, completes once, and the obsolete attempt's finalize affects zero rows.
8. **Late AI output cannot overwrite corrections.** Analysis starts, the user edits the quantity (revision advances, input hash changes), the analysis returns, and the draft still shows the user's value with `analysisStatus = FAILED` reason `SUPERSEDED`.
9. **Double save.** Two `saveMealAction` calls with one `clientRequestId` produce one meal and both return it.
10. **Stale edit from another device.** `updateMealAction` with an old revision returns `CONFLICT`; the UI keeps the edits and offers Reload.
11. **Reflection single flight.** Twenty concurrent first-visit requests produce one `GENERATING` row, one AI call, and twenty identical paragraphs.
12. **Reflection owner dies.** A `GENERATING` row older than 20 s is completed with the fallback by the next reader; a later provider response does not overwrite it.
13. **Reflection staleness.** Editing yesterday's lunch from Matched to Different food marks the message stale; editing a note does not.
14. **Backup restores a working app.** A dump plus photo copy restored into a scratch project lets a test user sign in, view the plan, open a photo, and see identical totals.
15. **Under-18 stop.** Entering 17 creates no Profile row; the delete action removes the User row.
16. **Photo cache is account-bound.** After logout and login as another user in the same browser, the first user's photo URL returns 404 and the cached entry is never served.
17. **Password limits.** A 73-byte multibyte password is rejected with `PASSWORD_TOO_LONG`; a 64-character ASCII password is accepted.
18. **Draft and photos expire together.** A draft last edited 25 hours ago is gone with its staged uploads; a draft edited 23 hours ago still opens with its photos.

## 22. Product document changes applied on September 16, 2026

The following passages of product-spec.md (now v1.7) and design-scope.md were changed to match section 0.1:

**No password recovery:** product-spec.md lines 53, 93, 119, 144, 606, 620, 684, 707, 744, 788; design-scope.md lines 12, 16, 37, 88, 115 (screen 1b removed, J14 shortened).

**No plan versions:** product-spec.md section 6 "Editing and history" (one plan, edits apply to all days, no effective date, no previous versions), the "Plan lifecycle" and "Calendar and week" rows of the defaults table, section 8 references to "assigned plan version" and "plan version changes mid-period", section 9 "Plan ended" state (an end date no longer exists; a plan is active until replaced or deleted), section 10 "split the comparison by plan version", section 11 inputs "yesterday's plan version", section 14 "Plan version" and "Day assignment" rows, section 17 checklist items about plan-version changes; design-scope.md screen 6 "version", "Previous versions", "Apply from", "Re-activate old version", and J10.

**Cross-midnight:** product-spec.md section 8 now states that a meal belongs wholly to the date the user chose (section 19 item 11).

**Corrected examples** in product-spec.md section 8, applied as product defaults pending owner review: the portion example is now "92 g instead of 80 g" (110 g was 37.5 percent); the seven-day summary looks for "Different food or marked skipped on three or more days", because unrecorded slots cannot occur on trend-eligible days; and the "counted once" sentence now states that a portion difference appears once in the portion component while the day's energy total enters only the nutrition component. The rubric fixtures encode this wording.

## Appendix A. Darkube-native fallback

If section 19 item 2 is triggered: create a Darkube PostgreSQL app (disk, internet access off, managed daily backup keep 7) and connect through the in-namespace address on port 5432 with `directUrl` equal to `url`; create a second Hamravesh Object Storage bucket for photos and point `S3_*` at it. No schema, adapter, or code change is needed. The nightly backup task then targets a different Hamravesh bucket from the photo bucket, and the restore rehearsal is repeated.
