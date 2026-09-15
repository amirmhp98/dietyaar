# Dietyaar — Product Reference

**Last updated:** 2026-09-16

> The short reference of what the product is and what exists in the code today. Agents read it
> before making product decisions and update it when a change is product-visible (new module,
> route, behaviour, data model). Keep it a reference, not a changelog. The full specifications are
> authoritative for what is planned: `product-spec.md` (behaviour, v1.7), `design-scope.md`
> (screens and journeys), `design.md` (visual), `tech-spec.md` (construction, v1.2).
> Lines marked _(boilerplate)_ ship with the template; lines marked _(planned)_ are specified but
> not built yet.

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

Navigation: bottom tabs **Today · History · My plan**, a profile button to Settings, and a
persistent **Log meal** button on all three tabs (design-scope.md). The boilerplate sidebar shell is
replaced when the product shell lands.

| Route                                                   | Who       | What                                                                                         | Status                                   |
| ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `/login`                                                | everyone  | Username/password sign-in (cookie session, throttled after 5 failures)                       | _(boilerplate)_                          |
| `/signup`                                               | everyone  | Username/password sign-up; states that a forgotten password cannot be recovered              | _(planned)_                              |
| `/onboarding`                                           | signed-in | One question per screen: age (under-18 stop), sex, height, weight, time zone, name, plan     | _(planned)_                              |
| `/today` (`/`)                                          | signed-in | Morning message, adherence score, planned slots vs. recorded meals, "Other" meals            | _(planned)_                              |
| `/history`                                              | signed-in | Date-based day view and compact seven-day summary                                            | _(planned)_                              |
| `/plan`                                                 | signed-in | The one plan: slots, options, items, targets, rules, notes; import / manual / edit / delete  | _(planned)_                              |
| `/meals/[id]`                                           | signed-in | One meal: items, nutrition, photos, slot link, edit, delete, reuse                           | _(planned)_                              |
| `/settings`                                             | signed-in | Profile, preferences, appearance, privacy, data export, account deletion                     | _(planned)_                              |
| `/admin/users`                                          | Admin     | List, create, edit, activate/deactivate users, reset passwords                               | _(boilerplate)_                          |
| `/components`                                           | signed-in | Component gallery / visual reference for the UI kit                                          | _(boilerplate)_                          |
| `/api/health`, `/api/live`                              | ops       | Readiness (database check) and liveness probes, no auth                                      | health _(boilerplate)_, live _(planned)_ |
| `/api/uploads`, `/api/uploads/[id]`, `/api/photos/[id]` | owner     | Photo upload (JPEG/PNG/WebP, re-encoded by sharp), staged delete, owner-checked photo stream | _(planned)_                              |
| `/api/export`                                           | signed-in | Streams a zip of profile, plan, meals, messages and photos                                   | _(planned)_                              |

Module inventory (tech spec § 4): `account`, `profile`, `plan`, `meal`, `day`, `reflection`,
`export`, plus the boilerplate `user` module. Each follows the Users reference shape
(`lib/validations` → `services` → `actions` → `app/(app)`).

## Behaviour worth knowing

- Deactivating a user or resetting their password ends all of their sessions immediately. _(boilerplate)_
- An admin cannot change their own role or deactivate themselves. _(boilerplate)_
- Sessions last `SESSION_MAX_AGE_DAYS`; the tech spec sets 90 days for Dietyaar (§ 8).
- No password recovery and no email of any kind. A lost password loses the account. _(planned)_
- One plan per user, edited in place through a draft. Editing or replacing the plan changes how
  every past day is compared, and the confirm screen says so. _(planned, decision 017)_
- A meal belongs wholly to the date the user chose; between 00:00 and 04:00 the composer asks
  "Was this for yesterday?". _(planned, tech spec § 19.11)_
- AI proposes; the user confirms; application code computes totals and comparisons on read, with
  no stored score. _(planned, decision 013)_
- Photo logging is behind `PHOTO_LOGGING_ENABLED`; photos are converted and downscaled on the
  device, stored in a private bucket, and served only through an owner-checked route. _(planned)_

## Data model

Built today (`prisma/schema.prisma`):

- `User` — `username` (unique), `passwordHash`, `fullName`, `role` (`ADMIN` \| `USER`), `isActive`, `lastLoginAt` _(boilerplate)_
- `Session` — `tokenHash` (SHA-256 of the cookie token, unique), `expiresAt`, cascades on user delete _(boilerplate)_

Planned (tech spec § 5, 15 tables; fields and enums are specified there):

- `User` extended with `usernameLower` (`citext`, unique), `deletionRequestedAt`, `deletionScheduledFor`, `onboardingStep`
- `Profile` — one per user: age, sex, height, weight, time zone, unit system, week start, appearance, goal, restrictions, AI-notice flags
- `Plan`, `PlanSlot`, `PlanOption`, `PlanItem`, `PlanTarget`, `PlanRule`, `PlanNote`, `PlanImportJob` — the one plan and its pending draft (`draftJson`)
- `DayRecord`, `DaySkippedSlot` — a calendar day in the user's zone, created lazily
- `Meal`, `FoodItem`, `Upload`, `MealDraft` — confirmed meals, their items and photos, and server-held drafts
- `MorningMessage` — one reflection per user per day, overwritten in place
- `AiCall`, `AnalyticsEvent`, `FoodDataCache`, `JobLock` — operational, pruned on a schedule

## Server actions

Built today:

| Action                | Auth  | Description                          |
| --------------------- | ----- | ------------------------------------ |
| `loginAction`         | none  | Validate credentials, open a session |
| `logoutAction`        | user  | Revoke the current session           |
| `createUserAction`    | admin | Create a user                        |
| `updateUserAction`    | admin | Change name / role                   |
| `setUserActiveAction` | admin | Activate or deactivate               |
| `resetPasswordAction` | admin | Set a new password, revoke sessions  |

Planned: the account, profile, plan, meal, reflection and history actions in tech spec § 7, all
returning `ActionResult`, authorising first, validating with zod, and taking `expectedRevision`
where the row is versioned.

## Non-functional

- Auth: httpOnly cookie sessions with hashed tokens, bcrypt (12 rounds), per-username login throttle, `SKIP_AUTH=true` for DB-less UI work (refused in production). _(boilerplate)_
- Security headers: HSTS, frame-deny, nosniff, referrer policy, permissions policy. _(boilerplate)_ CSP per tech spec § 8 _(planned)_.
- Deployment: Docker standalone image with health check; migrations applied on container start. _(boilerplate)_ Target: Darkube from a CI-built image; database and storage on Supabase free tier; backups to Hamravesh Object Storage (tech spec § 13, decisions 014, 016, 018).
- Quality gate: lint + typecheck + unit + build + e2e + Docker build in CI on every push. _(boilerplate)_ Integration project against real Postgres and a mobile Playwright project are planned (tech spec § 15).
- AI: DeepSeek through a fetch-based adapter with one deadline per operation, zod-validated responses, per-user daily caps and a global token budget (tech spec § 10).

## Roadmap

Ordered by dependency; each step maps to spec sections and becomes one or more beads issues.

1. **Setup checklist** (tech spec § 13) — Supabase project, buckets, Darkube app, and the cross-border reachability and latency measurements, recorded in `docs/runbook.md`. Blocks everything that touches data from the cluster.
2. **Foundations** — schema and migrations for § 5; `lib/time`, `lib/rubric`, `lib/text` with fixtures (§ 6, § 15); env additions (§ 14); added layering lint rules (§ 4).
3. **Account and onboarding** — sign-up, password rules, under-18 stop, resumable onboarding, profile (§ 7, § 8; design-scope screens 1–2).
4. **Product shell** — bottom tabs, Log meal button, Settings entry; replaces the boilerplate sidebar and placeholder dashboard (design-scope; design.md).
5. **Plan** — import job under the scheduler lease, draft review, manual plan, edit in place, confirm and remap (§ 5, § 7, § 10, § 12).
6. **Meals** — drafts, text analysis, review, save with idempotency and revisions, reuse, planned-as-eaten, links and skipped slots (§ 7, § 10).
7. **Today and History** — computed-on-read comparison, score, coverage, seven-day summary (§ 6).
8. **Reflection** — morning message with the claim protocol, staleness and fallbacks (§ 10.3).
9. **Photos** — device conversion, upload route, owner-checked viewing, cleanup (§ 11), behind the flag.
10. **Settings, export, deletion** — preferences, zip export, scheduled purge (§ 7, § 12).
11. **Ops** — Sentry, Loki metrics, backups to Hamravesh, runbook, AI evaluation harness (§ 10.5, § 13, § 16).
