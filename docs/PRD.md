# Dietyaar — Product Reference

**Last updated:** 2026-09-19

> The short reference of what the product is and what exists in the code today. Agents read it
> before making product decisions and update it when a change is product-visible (new module,
> route, behaviour, data model). Keep it a reference, not a changelog. The full specifications are
> authoritative for what is planned: `product-spec.md` (behaviour, v1.7), `design-scope.md`
> (screens and journeys), `design.md` (visual), `tech-spec.md` (construction, v1.2).
> Lines marked _(boilerplate)_ ship with the template; lines marked _(planned)_ are specified but
> not built yet. As of 2026-09-18 every V1 feature below is built; what remains is the deployment
> checklist (see "Not done yet").

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
one person on Darkube with Supabase free tier.

## Users

- **User** — signs up with username and password (no recovery, no email), completes onboarding,
  imports a plan, logs meals, reads Today, History, My plan, and Settings. _(boilerplate role `USER`)_
- **Admin** — the developer/operator. Manages accounts at `/admin/users` and everything a User can
  do; has no view of health data beyond the ops tool. _(boilerplate role `ADMIN`; tech spec § 19.9)_

## Locale

One locale profile (`src/lib/locale.ts`): English, LTR, Gregorian, Latin numerals, `UTC`, USD.
The profile's time zone is never read for product logic: every user has a `Profile.timeZone` and
every stored day carries the zone it was recorded in (tech spec § 9, decision 009). Plan and meal
text is accepted in any language and stored verbatim; a normalised parsing copy is produced by
`lib/text/normalize.ts`.

## Modules & routes

Navigation (`src/lib/navigation.ts`): bottom tabs **Today · History · My plan** (`BottomNav`), a
top bar with the page title and a profile button to Settings (`TopBar`), and a persistent
**Log meal** button on the three tabs that opens the composer sheet (`(app)/(shell)/layout.tsx`);
Meal details titles the bar "Meal" and hides the button.
Onboarding and the plan-import screens render outside the shell. The boilerplate sidebar is gone;
admin pages use the same shell.

| Route                                                   | Who       | What                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                                                | everyone  | Username/password sign-in (cookie session, throttled after 5 failures) _(boilerplate)_                                                                                                                                                                                                                                       |
| `/signup`                                               | everyone  | Username/password sign-up (common-password list, per-IP rate limit `SIGNUP_RATE_LIMIT`); says a forgotten password cannot be recovered; sets the session and the `appearance` cookie, redirects to onboarding                                                                                                                |
| `/onboarding`                                           | signed-in | One question per screen: age (under-18 stop deletes the account), sex, height, weight (metric/imperial), time zone, display name; resumable from `Profile.onboardingStep`; `?step=` reopens an answered question (Back from the plan step). Progress counts 11 steps: six questions, plan text, meals, targets, notes, ready |
| `/onboarding/plan`, `/plan/add`, `/plan/review`         | signed-in | Plan entry: paste text → import job with progress/retry/cancel, or the manual wizard (`/onboarding/plan/manual`); review draft (slots, options, items, targets, questions; notes shown read-only) → confirm; "No plan yet"                                                                                                   |
| `/today` (`/`)                                          | signed-in | Date header, device-zone hint, reflection card, "Your plan today" (score card, slot rows with match/portion/timing, Why this score, nutrition details), recorded meals, completeness checkbox                                                                                                                                |
| `/history`, `/history/[date]`                           | signed-in | Seven-day list with day states, starting at the account's first day ("Your history starts on …"); a past day's full view with its reflection; date picker for older days                                                                                                                                                     |
| `/plan`                                                 | signed-in | The one plan: today's slots with options and items, targets, "Notes from your plan"; Edit (in place through a draft), Replace, Delete; pending-draft banner                                                                                                                                                                  |
| `/meals/[id]`                                           | signed-in | One meal: items, nutrition, photos, slot link and match, edit in place (revisioned), delete with confirmation, reuse                                                                                                                                                                                                         |
| `/settings`                                             | signed-in | Profile (edit), preferences (appearance, units, time zone, week start), account (change password, log out), privacy text, export zip, delete account                                                                                                                                                                         |
| `/admin/users`                                          | Admin     | List, create, edit, activate/deactivate users, reset passwords _(boilerplate)_                                                                                                                                                                                                                                               |
| `/components`                                           | signed-in | Component gallery incl. the product components _(boilerplate)_                                                                                                                                                                                                                                                               |
| `/api/health`, `/api/live`                              | ops       | Readiness (database check) and liveness probes, no auth                                                                                                                                                                                                                                                                      |
| `/api/uploads`, `/api/uploads/[id]`, `/api/photos/[id]` | owner     | Photo upload (JPEG/PNG/WebP, re-encoded by sharp, `STORAGE_FULL` above the soft limit), staged delete, owner-checked photo stream (`?s=` session tag)                                                                                                                                                                        |
| `/api/export`                                           | signed-in | Streams a zip of profile, plan, meals, messages and photos                                                                                                                                                                                                                                                                   |

Module inventory (tech spec § 4): `account`, `profile`, `plan`, `meal`, `day` / `day-view`,
`reflection`, `export`, `upload`, `ai` (`services/ai/*`: DeepSeek adapter, interpret-plan,
analyze-meal, generate-reflection, prompts, usage caps), `jobs` (scheduler under a `JobLock`
lease: plan import, hourly cleanup, purge, prune, backup), `food-data` (unit table, scaling, USDA
lookup behind `USDA_LOOKUP_ENABLED`), `storage/s3`, plus the boilerplate `user` module. Pure logic
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

## Data model

`prisma/schema.prisma`, migration `0002_dietyaar_core` (tech spec § 5; every `DateTime` is
`timestamptz(3)`, local dates and times are ISO strings with the zone on the row):

- `User` — `username`, `usernameLower` (`citext`, unique), `passwordHash`, optional `fullName`, `role`, `isActive`, `lastLoginAt`, `onboardingStep`, `deletionRequestedAt`, `deletionScheduledFor`
- `Session` — `tokenHash` (SHA-256 of the cookie token, unique), `expiresAt`, cascades on user delete
- `Profile` — one per user: age, sex, height, weight, time zone, unit system, week start, appearance, display name, goal, restrictions, AI-notice timestamps, device-zone hint
- `Plan`, `PlanSlot`, `PlanOption`, `PlanItem`, `PlanTarget`, `PlanNote`, `PlanImportJob` — the one plan and its pending draft (`draftJson`, `draftRevision`)
- `DayRecord`, `DaySkippedSlot` — a calendar day in the user's zone, created lazily on the first meal, skip or completeness change
- `Meal`, `FoodItem`, `Upload`, `MealDraft` — confirmed meals (revisioned, `clientRequestId`), their items and photos, and server-held drafts
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
| `profile.actions.ts`         | `saveOnboardingStepAction`, `updateProfileAction`, `updatePreferencesAction`, `acknowledgeAiNoticeAction`, `reportDeviceTimeZoneAction`, `dismissTimeZoneHintAction`, `skipPlanAction`                                                                                                                   |
| `plan.actions.ts`            | `startPlanImportAction`, `getPlanImportStatusAction`, `retryPlanImportAction`, `cancelPlanImportAction`, `startManualPlanAction`, `updatePlanDraftAction`, `startPlanEditAction`, `estimateDraftBaselineAction`, `getPlanDraftAction`, `confirmPlanAction`, `discardPlanDraftAction`, `deletePlanAction` |
| `onboarding-plan.actions.ts` | `continueToTodayAction`, `finishOnboardingAction`, `countAffectedMealsAction`                                                                                                                                                                                                                            |
| `meal.actions.ts`            | `createMealDraftAction`, `analyzeMealDraftAction`, `updateMealDraftAction`, `saveMealAction`, `updateMealAction`, `deleteMealAction`, `setMealLinkAction`, `reuseMealAction`, `removeMealPhotoAction`, `getMealDraftAction`, `getRecentMealsAction`                                                      |
| `composer.actions.ts`        | `getComposerContextAction`, `getLastUsedOptionAction`                                                                                                                                                                                                                                                    |
| `day.actions.ts`             | `getDayAction`, `getSevenDayAction`, `markSlotSkippedAction`, `setDayCompletenessAction`                                                                                                                                                                                                                 |
| `reflection.actions.ts`      | `getMorningMessageAction`, `updateReflectionAction`, `acknowledgeReflectionAction`                                                                                                                                                                                                                       |

## Non-functional

- Auth: httpOnly cookie sessions with hashed tokens, bcrypt (12 rounds), per-username login throttle, `SKIP_AUTH=true` for DB-less UI work (refused in production).
- Security headers: HSTS, frame-deny, nosniff, referrer policy, permissions policy (`camera=(self)`), CSP per tech spec § 8 (`next.config.ts`).
- Deployment: Docker standalone image (hamdocker mirror ARG, `TZ=UTC`, `postgresql-client-17`) with health check; migrations applied on container start; CI runs lint, unit, integration (real Postgres), e2e (desktop + Pixel 7, stub AI server), migration check, Docker build and the Darkube deploy job (decision 014). Database and storage on Supabase free tier through the pooler (016); encrypted backups to Hamravesh Object Storage by the backup job and `npm run db:backup` (018). A Vercel staging deployment (`https://dietyaar.vercel.app`, built from GitHub `main`) runs with the scheduler off and a daily platform cron calling `/api/cron/all` behind `CRON_SECRET` (decision 021).
- Reads: nested Prisma reads use `relationJoins`, so Today is three statements (decision 020).
- AI: DeepSeek through a fetch-based adapter with one deadline per operation, one retry on network/5xx, zod-validated responses, per-user daily caps per kind and a global token budget (`AI_DAILY_TOKEN_BUDGET`). Stub server `e2e/stub-ai/server.mjs` for dev and e2e; `npm run ai:smoke` and `npm run ai:eval` against the real provider (results in `docs/runbook.md`).
- Observability: pino JSON logs with redaction, `/api/live` and `/api/health`, weekly analytics SQL in the runbook. No error tracker (owner decision: no new tools).
- Accessibility: axe (WCAG 2.1 AA + best practice) on Today, composer, review and Settings in both themes with zero serious/critical (`e2e/a11y.spec.ts`); 44 px targets; status never colour-only; `NameLabel` isolates mixed-direction names.
- Quality gate: `npm run lint:all`, `test` (458 unit), `test:integration` (20), `build`, `test:e2e` (both projects).

## Not done yet

- Tech spec § 13 setup on the cluster: Darkube app, Supabase project and buckets, the cross-border round trip `R`, ingress timeout and body limit; the runbook's measured-values table is filled from a developer machine only.
- A restore rehearsal of the backup job.
- `PHOTO_LOGGING_ENABLED` stays `false` in production until the photo evaluation (20 photos) passes; the `ai:eval` meal set is unreviewed (`reviewed: false`).

## Defaults awaiting owner review

Chosen at planning time (2026-09-17, `docs/implementation-plan.md` § 3) so development is not
blocked; binding until the owner revises them.

- Rubric v1 weights and thresholds and the three-block Today layout exactly as product-spec § 8–9.
- Visual language: design.md tokens on the local shadcn kit, 44 px touch targets (decision 019).
- Photo logging is built but ships with `PHOTO_LOGGING_ENABLED=false` until the evaluation passes; e2e and local dev run with it on.
- Supabase region `eu-central-1`; domain `dietyaar.darkube.app`; session lifetime 90 days.
- No numeric accuracy claim anywhere; nutrition values are labelled "Estimated".
- `User.fullName` is optional (sign-up has no name field); greeting uses display name, then username.
- Photo capacity: 1280 px uploads; on the free storage tier the photo flag is for a pilot of at most ~30 users; the target workload needs the storage upgrade.
- Backups: encrypted dumps kept 30 days by age; a purged account's photo copies are deleted from the backup bucket.

## Roadmap

V1 is built in the order of `docs/implementation-plan.md` § 5 (phases 1–11). What comes next is
the owner's call: the deployment checklist above, then the photo evaluation and the storage
upgrade decision (tech spec § 19).
