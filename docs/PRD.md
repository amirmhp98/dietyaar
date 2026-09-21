# Dietyaar — Product Reference

**Last updated:** 2026-09-21

> The short reference of what the product is and what exists in the code today. Agents read it
> before making product decisions and update it when a change is product-visible (new module,
> route, behaviour, data model). Keep it a reference, not a changelog. The full specifications are
> authoritative for what is planned: `product-spec.md` (behaviour, v1.8), `design-scope.md`
> (screens and journeys), `design.md` (visual, with the "Product UI" section of decision 025),
> `tech-spec.md` (construction, v1.2).
> Lines marked _(boilerplate)_ ship with the template; lines marked _(planned)_ are specified but
> not built yet. As of 2026-09-18 every V1 feature below is built, and as of 2026-09-21 the
> improvement plan's phases A–D (`docs/improvement-plan.md`) are merged; what remains is the
> launch checklist (see "Not done yet").

## What it is

Dietyaar helps a person who already follows a diet understand how their actual eating compares
with that plan and make one useful next decision, with very little daily effort. The user brings
their existing plan in any language (often a menu of options per meal, sometimes per weekday), the
AI turns it into a readable, editable plan the user confirms, and from then on the user logs what
they actually ate by text, photo, or manual entry, corrects the AI's food and portion estimate, and
sees a focused Today view with an adherence score, a seven-day history, and a short morning
paragraph that reflects on yesterday. The product follows the user's plan: it never generates a
diet, never infers a deficit, and never treats eating less as better. English UI, mobile-first web,
DeepSeek as the AI provider, one plan per user edited in place. First release is unpaid and run by
one person on a single VPS (app, Postgres and MinIO in one compose stack, decision 026), with a
Vercel + Supabase staging deployment (decision 021).

## Users

- **User** — signs up with username and password (no recovery, no email), completes onboarding,
  imports a plan, logs meals, reads Today, History, My plan, and Settings. _(boilerplate role `USER`)_
- **Admin** — the developer/operator. Manages accounts at `/admin/users` and everything a User can
  do; has no view of health data beyond the ops tool. _(boilerplate role `ADMIN`; tech spec § 19.9)_

## Locale

One locale profile (`src/lib/locale.ts`): English, LTR, Gregorian, Latin numerals, `UTC`, USD.
The profile's time zone is never read for product logic: every account counts its days in
`APP_TIME_ZONE` (`Asia/Dubai`, `src/lib/time/zone.ts`), the user never sees or sets a zone, and
every stored day carries the zone it was computed in (tech spec § 9, decision 022). Plan and meal
text is accepted in any language and stored verbatim; a normalised parsing copy is produced by
`lib/text/normalize.ts`. Food and slot names are shown as the user wrote them (`NameLabel`,
`InlineName`); the English label the AI produces stays in the data for matching, restrictions and
prompts and is never rendered or edited: a slot or food named by hand is its own label. An amount
typed on a plan item with no unit chosen is in grams. Plan options are shown as "Option 1 /
Option 2 …" from their position in the slot; the pasted heading (`PlanOption.label`) is provenance
only.

## Modules & routes

Navigation (`src/lib/navigation.ts`): bottom tabs **History · Today · My plan**, Today in the middle (`BottomNav`,
phones only; the active tab sits on a tinted pill), one top bar that carries the page title as the h1 on phones
and the same three tabs on wider screens (`TopBar`, no second band), a profile button to Settings, and a persistent
**Log meal** button on the three tabs that opens the composer sheet (`(app)/(shell)/layout.tsx`);
Meal details titles the bar "Meal" and hides the button, as do the plan flows (`/plan/add`, `/plan/review`),
which carry their own filled primary. Product pages do not repeat the title beneath the bar.
Onboarding and the plan-import screens render outside the shell. The boilerplate sidebar is gone;
admin pages use the same shell.

| Route                                                   | Who       | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                                                | everyone  | Username/password sign-in (cookie session, throttled after 5 failures) _(boilerplate)_                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/signup`                                               | everyone  | Username/password sign-up (common-password list, per-IP rate limit `SIGNUP_RATE_LIMIT`); says a forgotten password cannot be recovered; sets the session and the `appearance` cookie, redirects to onboarding                                                                                                                                                                                                                                                                                                                                  |
| `/onboarding`                                           | signed-in | One question per screen: age (under-18 stop deletes the account), sex, height, weight (metric/imperial), display name; resumable from `Profile.onboardingStep`; `?step=` reopens an answered question (Back from the plan step). Progress counts 10 steps: five questions, plan text, meals, targets, notes, ready                                                                                                                                                                                                                             |
| `/onboarding/plan`, `/plan/add`, `/plan/review`         | signed-in | Plan entry: paste text → import job with progress/retry/cancel, or the manual wizard (`/onboarding/plan/manual`); review draft (slots, options, items, targets, questions; notes shown read-only) → confirm; "No plan yet"                                                                                                                                                                                                                                                                                                                     |
| `/today` (`/`)                                          | signed-in | Date header, reflection (note surface; capped to ~4 lines with Read more until Got it), "Your plan today" (hero score card with band glyph, numeral and a neutral "N of M recorded" bar; glyph-led slot rows in a list surface with their window, match/portion/timing and icon actions per window state, skip/unskip optimistic; Why this score; nutrition value / target rows with bars), recorded meals rows (time · names · kcal · camera glyph · chevron), completeness checkbox; illustrated empty states (no plan, no meals, first day) |
| `/history`, `/history/[date]`                           | signed-in | "The past seven days": the pattern sentence with its complete / incomplete-day counts as one note surface, day rows with a glyph, the band word and the number ("Marked complete · 2 of 5 meals recorded" for a checked day with gaps), starting at the account's first day ("Your history starts on …"); a past day's full view with the reflection written the next morning; date picker for older days                                                                                                                                      |
| `/plan`                                                 | signed-in | The one plan: name with Edit / Replace / Delete as icon actions, goal, today's slots (or weekday tabs) as cards with the window ("≈ 12:00–15:30" when assumed) and kcal range, options as "Option n · k items" pills, slots folded after two ("Show all 5 meals"), daily targets, "Notes from your plan", source text; pending-draft banner                                                                                                                                                                                                    |
| `/meals/[id]`                                           | signed-in | One meal, titled "Meal" in the top bar with the Log meal button hidden: photo strip, the names as the title with Edit / Reuse / Delete icon actions, slot link ("Linked to … · Option n" with the match, or "Extra") with Change plan link, items as compact rows, nutrition, sources, notes, differences as chips; edit in place (revisioned), delete with confirmation                                                                                                                                                                       |
| `/settings`                                             | signed-in | Profile (edit; no time-zone field), preferences (units, week start, appearance), account (change password, log out), privacy (AI note behind a disclosure, export zip, "Delete account" as a text-destructive action), Tools (admins only: Users, Components)                                                                                                                                                                                                                                                                                  |
| `/admin/users`                                          | Admin     | List, create, edit, activate/deactivate users, reset passwords _(boilerplate)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/components`                                           | signed-in | Component gallery incl. the product components and the "Product UI" primitives of decision 025 (surfaces, glyphs, icon actions, illustrations, numeral, tint ladder), the visual regression surface for both themes                                                                                                                                                                                                                                                                                                                            |
| `/api/health`, `/api/live`                              | ops       | Readiness (database check) and liveness probes, no auth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/api/uploads`, `/api/uploads/[id]`, `/api/photos/[id]` | owner     | Photo upload (JPEG/PNG/WebP, re-encoded by sharp, `STORAGE_FULL` above the soft limit), staged delete, owner-checked photo stream (`?s=` session tag)                                                                                                                                                                                                                                                                                                                                                                                          |
| `/api/export`                                           | signed-in | Streams a zip of profile, plan, meals, messages and photos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Module inventory (tech spec § 4): `account`, `profile`, `plan`, `meal`, `day` / `day-view`,
`reflection`, `export`, `upload`, `ai` (`services/ai/*`: DeepSeek adapter, interpret-plan,
analyze-meal, generate-reflection, prompts, usage caps), `jobs` (scheduler under a `JobLock`
lease: plan import, hourly cleanup, purge, prune, backup), `food-data` (unit table of measures plus the food-weight hints, scaling through `unitGrams`,
USDA lookup behind `USDA_LOOKUP_ENABLED`), `storage/s3`, plus the boilerplate `user` module. Pure logic
lives in `lib/rubric` (matching, portions, timing, score, nutrition, facts, seven-day) and
`lib/time` (zone-aware local dates).

## Behaviour worth knowing

- Deactivating a user or resetting their password ends all of their sessions immediately. _(boilerplate)_
- An admin cannot change their own role or deactivate themselves. _(boilerplate)_
- Sessions last `SESSION_MAX_AGE_DAYS` (90). Changing the password signs out every other device.
- No password recovery and no email of any kind. A lost password loses the account.
- Rules are not evaluated in V1 (decision 023): every plan instruction that is not a meal, target
  or schedule is a `PlanNote`, kept verbatim, shown once on review and under "Notes from your
  plan" on My plan, never compared. The import prompt extracts notes only; the manual wizard has
  no rules step.
- One plan per user, edited in place through a draft (`Plan.draftJson`, `draftRevision`).
  Confirming an edit or replacement changes how every past day is compared, and the confirm screen
  says how many meals are affected (decision 017). While a draft exists `Plan.status` is
  `DRAFT_PENDING`; "has an active plan" means confirmed with slots.
- Plan import runs as a job under the scheduler lease (claimed atomically, 120 s AI deadline, one
  retry from the banner; a job's internal retries share its one daily admission); menu plans are
  one call, weekday plans one call per weekday heading (a range such as "شنبه تا پنجشنبه" is one
  call applied to every day of the range), then a batched baseline estimate (20 items per call).
- The composer never preselects an option for a multi-option slot; the last-used option is only
  suggested ("Last time"). "I ate this" (the planned path) cannot save without an option; any
  other path needs one only when the recorded items overlap an option, otherwise the meal saves
  under the slot as a different food with no option. A meal under "Other" (shown as "Extra · in
  addition to your plan") counts in nutrition only; the review always states the outcome in one
  line ("Linked to ناهار · Option 2" / "Extra meal · not part of your plan"), and Extra is the
  default when the AI suggests no slot or the chosen slot is already recorded that day.
- Review is a loop, not a one-shot: answering one of the AI's portion questions (or pressing
  Re-estimate) sends the current items, the user's names and values and the answers back in
  `REFINE` mode; the model fills what the answers make known and returns `changes[]`, shown as
  "What changed". Renames, label values and edited quantities always survive; an edited name
  marks the item for a new estimate. Choice answers that name a unit ("2 slices") set the
  quantity immediately.
- Units are measures (decision 024): `g, kg, ml, l, glass, cup, tsp, tbsp, bowl` and the count
  units `piece, slice, sheet, skewer, handful, serving`. A counted item reads "2 × سیب" or
  "1 slice · نان سنگک" (plurals via `tp()`), the size stays in the name, and the grams of one
  unit live on the item (`unitGrams`, "≈ 180 g each"), estimated by the AI from a hint table
  or its own knowledge and editable on review (a −/+ stepper and a "grams each" field for
  counts). Portions compare through grams when both sides convert, by count when they share
  the unit, otherwise "Not evaluated".
- The composer is intent-aware (decision 025, D2): opened from a slot row it leads with that
  slot's option list ("Option n", items, kcal, "Last time"; nothing preselected), then
  "Something else?" with the text box and photo actions, then Recent meals when there are any;
  opened from the Log meal button or a History day it leads with the text box, then the day's
  planned slots as pills with their status glyph, then Recent. "Check this meal" (outline)
  and "Enter manually" sit in a pinned footer with the date/time summary. The review is one
  compact row per item (amount · name · kcal · chevron) that expands into its editor
  (quantity stepper or field, unit, unknown, grams each, name, preparation, alternatives,
  label values, remove); badges appear only for Assumed, Label values, Needs a new estimate
  and Check this value; questions are one note surface with pill choices; the totals strip
  carries "What changed" and Sources; date, time, "I don't remember the time" and notes sit
  under "More details" (open by itself when the day is backdated or a time is still needed).
  The pinned footer holds the slot sentence with its glyph and the Change action, the option
  chooser when one is owed, the date/time summary, the reason Save is held back, and Save meal
  (the sheet's one filled action). A row whose quantity is unknown opens on its editor unless
  a question already asks for it.
- The composer has a Back arrow from the review to the compose step (no re-analysis when the
  input is unchanged) and a Start over action that discards the server draft and its staged
  photos; a resumed draft says "Continuing where you left off". Unticking "I don't remember
  the time" leaves the time empty (never 12:00) and Save disabled until a time is typed.
- Photo actions are native file inputs: on touch devices Take photo (camera) and Choose from
  gallery, on desktop one Add photo; the staged photos show as thumbnails on the review. Local
  storage is MinIO via `npm run storage:up`; CI runs the photo e2e against it.
- A meal belongs wholly to the date the user chose; between 00:00 and 04:00 in the profile zone
  the composer asks "Was this for yesterday?". Backdated meals need a time.
- Saving is idempotent per `clientRequestId`; meals and drafts carry a `revision`, stale writes
  return `CONFLICT` (plan-draft writes are conditional on the stored `draftRevision`). Analysis
  failures keep the text and offer manual entry. Skips and completeness refuse a future day like
  meals do.
- AI proposes; the user confirms; application code computes totals, matches and the score on
  read, with no stored score (decision 013). The AI notice is shown once per kind (plan, meal,
  photo) and acknowledged on the profile.
- The morning reflection uses the claim protocol (facts in, `usedFactIds` out), is marked stale
  when a claimed fact changes, falls back to fixed paragraphs when the AI is unavailable, and uses
  fixed paragraphs, without an AI call, on the first day, when yesterday has no records and when
  there is no plan (`isStatic`; only a "no records" paragraph goes stale, when a meal is added to
  yesterday). Got it (`acknowledgedAt`) moves the card to the bottom of Today for the day, collapsed
  to its title with Read again.
- Photo logging is behind `PHOTO_LOGGING_ENABLED` (off by default); photos are converted and
  downscaled on the device, stored in a private bucket, and served only through an owner-checked
  route.
- Appearance (system / light / dark) is stored on the profile and mirrored in an `appearance`
  cookie so the first paint has the right theme; logging out clears the cookie.
- Route handlers (`/api/uploads*`, `/api/photos/[id]`, `/api/export`) answer an expired session
  with `401 { error: 'UNAUTHENTICATED' }` rather than the page redirect.
- The score card names the date on a past day and, before any planned meal is scored, says that
  the number appears after two; "Why this score" shows only once a meal is scored. The reflection
  withholds the daily energy fact on a day that is complete by default. "Your plan changed" is
  shown only for a confirmation after the plan's first day.
- Account deletion is scheduled (`deletionScheduledFor`) and purged by the purge job, including
  backup copies of photos.
- Every plan slot has a time window: stated times as written, otherwise one assumed from the
  slot's name on confirm (`lib/rubric/windows.ts`, `PlanSlot.timeAssumed`; unrecognised names
  split 07:00–22:00 between their neighbours). Today shows it as "≈ 12:00–15:30" and lets the
  window state drive the row's icon actions (open or passed: Log ＋ and Skip —, passed adds
  "Window passed · log it or mark skipped"; upcoming: one faint ＋ only); the highlighted row is
  the first open or passed unrecorded slot, with an outline "Log this meal" so the floating Log
  meal button stays the one filled action. An assumed window never enters the timing score (the
  order rule stays); typing a time in the slot editor makes it stated.

## Data model

`prisma/schema.prisma`, migration `0002_dietyaar_core` (tech spec § 5; every `DateTime` is
`timestamptz(3)`, local dates and times are ISO strings with the zone on the row):

- `User` — `username`, `usernameLower` (`citext`, unique), `passwordHash`, optional `fullName`, `role`, `isActive`, `lastLoginAt`, `onboardingStep`, `deletionRequestedAt`, `deletionScheduledFor`
- `Session` — `tokenHash` (SHA-256 of the cookie token, unique), `expiresAt`, cascades on user delete
- `Profile` — one per user: age, sex, height, weight, unit system, week start, appearance, display name, goal, restrictions, AI-notice timestamps
- `Plan`, `PlanSlot`, `PlanOption`, `PlanItem` (`unit` a measure, `unitGrams` for counts), `PlanTarget`, `PlanNote`, `PlanImportJob` — the one plan and its pending draft (`draftJson`, `draftRevision`)
- `DayRecord`, `DaySkippedSlot` — a calendar day in the app zone (decision 022), created lazily on the first meal, skip or completeness change
- `Meal`, `FoodItem` (`unit`, `unitGrams` as on `PlanItem`), `Upload`, `MealDraft` — confirmed meals (revisioned, `clientRequestId`), their items and photos, and server-held drafts
- `MorningMessage` — one reflection per user per day, overwritten in place, with the facts hash and claimed fact ids
- `AiCall`, `AnalyticsEvent`, `FoodDataCache`, `JobLock` — operational, pruned on a schedule

## Server actions

All return `ActionResult` (`{ ok, data } | { ok: false, error, code?, fieldErrors?, details? }`),
authorise first (`requireAuth` / `requireOnboarded` / `requireAdmin`), validate with zod, and take
`expectedRevision` where the row is versioned.

| File                         | Actions                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.actions.ts`            | `loginAction`, `logoutAction` _(boilerplate)_                                                                                                                                                                                                                                                            |
| `user.actions.ts`            | `createUserAction`, `updateUserAction`, `setUserActiveAction`, `resetPasswordAction` _(boilerplate, admin)_                                                                                                                                                                                              |
| `account.actions.ts`         | `signUpAction`, `changePasswordAction`, `requestAccountDeletionAction`, `deleteUnderageAccountAction`                                                                                                                                                                                                    |
| `profile.actions.ts`         | `saveOnboardingStepAction`, `updateProfileAction`, `updatePreferencesAction`, `acknowledgeAiNoticeAction`, `skipPlanAction`                                                                                                                                                                              |
| `plan.actions.ts`            | `startPlanImportAction`, `getPlanImportStatusAction`, `retryPlanImportAction`, `cancelPlanImportAction`, `startManualPlanAction`, `updatePlanDraftAction`, `startPlanEditAction`, `estimateDraftBaselineAction`, `getPlanDraftAction`, `confirmPlanAction`, `discardPlanDraftAction`, `deletePlanAction` |
| `onboarding-plan.actions.ts` | `continueToTodayAction`, `finishOnboardingAction`, `countAffectedMealsAction`                                                                                                                                                                                                                            |
| `meal.actions.ts`            | `createMealDraftAction`, `analyzeMealDraftAction`, `updateMealDraftAction`, `saveMealAction`, `updateMealAction`, `deleteMealAction`, `setMealLinkAction`, `reuseMealAction`, `removeMealPhotoAction`, `getMealDraftAction`, `getRecentMealsAction`                                                      |
| `composer.actions.ts`        | `getComposerContextAction`, `getLastUsedOptionAction`                                                                                                                                                                                                                                                    |
| `day.actions.ts`             | `getDayAction`, `getSevenDayAction`, `markSlotSkippedAction`, `setDayCompletenessAction`                                                                                                                                                                                                                 |
| `reflection.actions.ts`      | `getMorningMessageAction`, `updateReflectionAction`, `acknowledgeReflectionAction`                                                                                                                                                                                                                       |

## Non-functional

- Auth: httpOnly cookie sessions with hashed tokens, bcrypt (12 rounds), per-username login throttle, `SKIP_AUTH=true` for DB-less UI work (refused in production).
- Security headers: HSTS, frame-deny, nosniff, referrer policy, permissions policy (`camera=(self)`), CSP per tech spec § 8 (`next.config.ts`).
- Deployment: Docker standalone image (hamdocker mirror ARG, `TZ=UTC`, `postgresql-client-17`) with health check; migrations applied on container start. CI runs lint, unit, integration (real Postgres), e2e (desktop + Pixel 7, stub AI server, MinIO started by `npm run storage:up` so the photo spec runs), migration check, Docker build, then pushes the image to GHCR and the `deploy-vps` job SSHes into the VPS (`https://85-198-48-114.sslip.io`, Caddy TLS, Postgres 17 and MinIO on the box, decision 026); the Darkube deploy job stays gated behind `DARKUBE_ENABLED` (decision 014). A Vercel staging deployment (`https://dietyaar.vercel.app`, built from GitHub `main`) uses Supabase for the database and photo bucket (016), runs with the scheduler off and a daily platform cron calling `/api/cron/all` behind `CRON_SECRET` (decision 021). Encrypted backups to Hamravesh Object Storage by the backup job and `npm run db:backup` (018); the runbook's "Environment variables by target" table lists every `S3_*` and flag per target.
- Reads: nested Prisma reads use `relationJoins`, so Today is three statements (decision 020).
- AI: DeepSeek through a fetch-based adapter with one deadline per operation, one retry on network/5xx, zod-validated responses, per-user daily caps per kind and a global token budget (`AI_DAILY_TOKEN_BUDGET`). Stub server `e2e/stub-ai/server.mjs` for dev and e2e; `npm run ai:smoke` and `npm run ai:eval` against the real provider (results in `docs/runbook.md`).
- Observability: pino JSON logs with redaction, `/api/live` and `/api/health`, weekly analytics SQL in the runbook. No error tracker (owner decision: no new tools).
- Accessibility: axe (WCAG 2.1 AA + best practice) on Today, composer, review and Settings in both themes with zero serious/critical (`e2e/a11y.spec.ts`); 44 px targets; status never colour-only; `NameLabel` isolates mixed-direction names.
- Quality gate: `npm run lint:all`, `test` (458 unit), `test:integration` (20), `build`, `test:e2e` (both projects).

## Not done yet

- The Hamravesh backup bucket `dietyaar-backup` and its key do not exist yet, so `BACKUP_ENABLED=false` on the VPS and the box holds the only copy of the data; decision 026 requires the bucket before real users sign up. The ingress timeout has never been measured with a long (50 s) analysis request (Caddy sets none, Node's default is 300 s). The Darkube items of tech spec § 13 (app, round trip `R`) are obsolete for launch (decision 026); the rest of the setup checklist is recorded in the runbook.
- The `deploy-vps` job and the CI MinIO step have not yet run on GitHub: `main` is ahead of `origin/main`, and the first push exercises both.
- A restore rehearsal of the backup job (the runbook's "Backups" section has the VPS-shaped steps; blocked on the bucket).
- `PHOTO_LOGGING_ENABLED` stays `false` in production until the photo evaluation (20 photos) passes; the `ai:eval` meal set is unreviewed (`reviewed: false`), so the runbook's recall number is not yet the reviewed one the improvement plan's gate A asks for.
- The owner's phone walkthrough (`docs/pilot-checklist.md`: iOS Safari and Android Chrome, light and dark) has not been run; every step is green before users are invited (improvement plan E4).

## Defaults awaiting owner review

Chosen at planning time (2026-09-17, `docs/implementation-plan.md` § 3) so development is not
blocked; binding until the owner revises them.

- Rubric v1 weights and thresholds and the three-block Today layout exactly as product-spec § 8–9.
- Visual language: design.md tokens on the local shadcn kit, 44 px touch targets (decision 019); since decision 025 the `design.md` "Product UI" section sets the consumer character — three surfaces (`hero` / `list` / `note`), icon + title section headers, a neutral status glyph set, icon-first actions, Manrope for headings and the score numeral, pills, a `--tint-1/2/3` ladder, top-centre toasts, a 2 px offset focus ring. Today adopted them in D1 (`ScoreCard`, `PlanSlotRow`, `ReflectionCard`, `NutritionDetails` + `MeterBar`, `ImportStatusBanner`, `CompletenessCheckbox`); D3 re-skinned History (one note-surface summary with the pattern sentence in the display face and glyph count lines, day rows with band glyph + word + number, the seven-day sentence split into "different food" and "skipped" variants), My plan (plan header with icon actions, slot cards with clock/flame sublines, options as pills, slots folded after two behind "Show all N meals", targets as a two-column list, notes as a note surface), the plan review screens, Meal details (photo strip first, compact item rows, chips, icon actions), Settings (section headers, no duplicate h1, privacy note behind a disclosure, "Delete account" as a text-destructive ghost), onboarding (28 px display question, note-surface hints, `ready` illustration) and the sign-in / sign-up pages (one value line under the logo); D2 re-skinned the composer (intent-aware blocks, pill chips with status glyphs, native photo actions, pinned footer) and the review (compact item rows, pill questions, the slot sentence and Save in a pinned footer).
- Photo logging is built but ships with `PHOTO_LOGGING_ENABLED=false` until the evaluation passes; e2e and local dev run with it on.
- Supabase region `eu-central-1` (staging); production is reached at `https://85-198-48-114.sslip.io` until a domain is chosen; session lifetime 90 days.
- No numeric accuracy claim anywhere; nutrition values are labelled "Estimated".
- `User.fullName` is optional (sign-up has no name field); greeting uses display name, then username.
- Photo capacity: 1280 px uploads; on the free storage tier the photo flag is for a pilot of at most ~30 users; the target workload needs the storage upgrade.
- Backups: encrypted dumps kept 30 days by age; a purged account's photo copies are deleted from the backup bucket.

## Roadmap

V1 is built in the order of `docs/implementation-plan.md` § 5 (phases 1–11). What comes next is
the owner's call: the deployment checklist above, then the photo evaluation and the storage
upgrade decision (tech spec § 19).
