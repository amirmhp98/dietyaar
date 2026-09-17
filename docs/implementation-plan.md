# Implementation plan — Dietyaar

Date: 2026-09-16, conflicts closed 2026-09-17 · Baseline commit: `0159807` (specs on top of boilerplate `a622806`)
Status: planning document, ready for execution. Nothing below is built unless the "Baseline" section says so. Every item in section 3 is resolved; section 3.4 lists the defaults chosen at planning time so the owner can revise them later without blocking work.

This plan tells a coding agent what to build, in what order, in which files, and how to prove
each step, without re-reading the whole repository or inventing product decisions. It is derived
from the four specs and from an inspection of the code as it is today. Where the specs and the
code disagree, section 3 says what to do; where the specs disagree with each other, section 3
says which wins and marks the rest as open.

Sources of truth, in precedence order for their own domain:

| Source                  | Owns                                                        | Version read |
| ----------------------- | ----------------------------------------------------------- | ------------ |
| `docs/product-spec.md`  | Behaviour, rules, states, acceptance criteria (PS-§n below) | v1.7         |
| `docs/design-scope.md`  | Screens, per-screen shows/actions, journeys J1–J14 (DS-n)   | 2026-09-16   |
| `docs/design.md`        | Tokens: colour, type, radius, spacing, elevation (DM)       | alpha        |
| `docs/tech-spec.md`     | Construction: schema, actions, AI, jobs, deploy (TS-§n)     | v1.2         |
| `docs/decisions/008+`   | Why a boilerplate rule was changed                          | 008–018      |
| Repository at `0159807` | What exists and the conventions to keep (`AGENTS.md`)       | —            |

Rule from TS-§0.1: where the tech spec and the product spec disagree on something not covered by
the September 16 owner decisions, the product spec wins. Rule from `AGENTS.md`: layering is
lint-enforced; every feature follows the Users reference module shape.

## 1. How to execute this plan

- Work phase by phase (section 5). Phases are ordered by dependency; inside a phase, tasks are
  ordered so each leaves `npm run lint:all`, `npm run test` and `npm run build` green.
- Track every task in beads (`.beads/` exists, zero issues today). Section 5 gives one issue title
  per task; create them with `bd create --type=task --priority=N` and add `bd dep add` edges as
  listed. Close only after the user confirms.
- Before starting a task, read the spec sections it cites. Do not read the whole spec again.
- Every task ends with: strings in `src/messages/en.ts`, tests as listed, `docs/PRD.md` updated
  when the change is product-visible (`AGENTS.md` › Definition of done).
- Nothing in section 3 is open. Defaults marked **DEFAULT** are built as written and listed in `docs/PRD.md` for owner review; a later owner change is a new task, not a blocker.
- Do not run `prisma db push`, `migrate reset`, or anything under `.claude/settings.json` › deny.

## 2. Baseline — what the repository contains today (evidence)

Verified on 2026-09-16: `npm run lint:all` passes; `npm run test` passes (12 files, 114 tests);
local Postgres (`dietyaar-db`, host port 5433) is up; git tree is clean.

### 2.1 Stack as installed

| Piece                      | Evidence                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3.5, React 19.3 | `package.json`; `next.config.ts` (`reactCompiler: true`, `output: 'standalone'`, `serverActions.bodySizeLimit: '2mb'`)        |
| Prisma 6.19.3              | `prisma/schema.prisma` (no `directUrl`, no extensions), `prisma.config.ts` (seed via `tsx`)                                   |
| zod 4.6.5                  | `src/lib/env.ts`, `src/lib/validations/*` (uses `z.url`, `z.enum` v4 API)                                                     |
| date-fns 4.4 (+ jalali)    | in `package.json`; not imported anywhere in `src/` today — `@/lib/format` is Intl-only                                        |
| Vitest 5, mock-extended    | `vitest.config.mts` (node env, `src/__tests__/**/*.test.ts`, coverage 60/55/60)                                               |
| Playwright 1.63            | `e2e/playwright.config.ts`: projects `setup`, `auth`, `chromium` (Desktop Chrome only)                                        |
| Tailwind 4, shadcn kit     | `src/components/ui/*` (37 files), barrel `src/components/UiComponents.tsx`, `components.json` (`rtl: true`, style `new-york`) |
| pino, bcryptjs, sonner     | `src/lib/logger.ts` (redacts password/token/cookie only), `services/auth.service.ts`                                          |
| Node 24.8 locally          | `.nvmrc` = `lts/*`; `engines.node >= 22`                                                                                      |

Not installed (TS-§3 "Added dependencies"): `@aws-sdk/client-s3`, `sharp`, `heic-to`,
`@date-fns/tz`, `archiver`, `@sentry/nextjs`, `@axe-core/playwright`. No AI SDK is planned.

### 2.2 Data

- `prisma/schema.prisma`: `User { id, username @unique, passwordHash, fullName (required), role, isActive, lastLoginAt, createdAt, updatedAt }` and `Session { tokenHash @unique, expiresAt }`. All `DateTime` map to `TIMESTAMP(3)` (migration `0001_init`), not `Timestamptz(3)` as TS-§3 requires.
- One migration: `prisma/migrations/0001_init/migration.sql`. No `lock_timeout` preamble (TS-§13).
- `prisma/seed.ts` upserts admin `admin`/`admin123` with `fullName: 'مدیر سیستم'` (Persian leftover).

### 2.3 Auth and request gate

- `src/proxy.ts`: cookie-presence gate, `PUBLIC_ROUTES = ['/login']`, matcher excludes `api/`.
- `src/lib/auth.ts`: `getSession` (React `cache`), `requireAuth` → `/login`, `requireAdmin` → `/`. `SKIP_AUTH` mock user.
- `src/services/auth.service.ts`: bcrypt 12, SHA-256 token hash, in-memory per-username throttle (5 / 15 min), `authenticate`, `findUserBySessionToken`, `revokeSession`, `revokeAllSessions`. Session length from `env.SESSION_MAX_AGE_DAYS` (default 7; `.env.example` says 7; TS-§8 wants 90).
- `src/actions/auth.actions.ts`: `loginAction` (useActionState shape, redirects to `/`), `logoutAction`.
- `src/lib/validations/user.ts`: admin username rule `^[a-z0-9._-]+$/i`, 3–32; password 8–128. This differs from the product sign-up rule (PS-§5: 3–30, `[A-Za-z0-9_]`; TS-§8: password 8–64 chars, ≤72 bytes, common-list check).

### 2.4 App shell and pages

- `src/app/layout.tsx`: `<html class="dark" data-theme="dark">`, inline script reads `localStorage.theme`; only `light`/`dark`, default dark. No `prefers-color-scheme` handling; `src/lib/theme.ts` is a two-state localStorage store.
- `src/app/(app)/layout.tsx`: desktop `Sidebar` + `Header` + `SidebarProvider` (cookie `sidebar-collapsed`). This is the shell TS-§4 marks REPLACED.
- `src/app/(app)/page.tsx`: placeholder dashboard (`home.*` strings). `src/app/(app)/components/page.tsx`: UI gallery. `src/app/(app)/admin/users/*`: Users module (kept per TS-§19.9).
- `src/app/(auth)/login/*`: login form (`useActionState`), show/hide password.
- `src/app/api/health/route.ts`: DB `SELECT 1` readiness. No `/api/live`.
- `src/lib/navigation.ts`: `NAV_GROUPS` for the sidebar (Home, Components, Users); `pageTitleFor`.
- `src/components/ui/`: has Sheet with `side: top|bottom|start|end`, Dialog, Checkbox, RadioGroup, Tabs, Progress, Stepper, Textarea, Select, DatePicker/Calendar, Skeleton, Spinner, Tooltip, Popover, DropdownMenu, `Ltr` (`<bdi dir="ltr">`). **Absent**: Accordion/Collapsible, AlertDialog, Drawer.
- `src/app/globals.css`: HSL token system, brand hue 142 (green — close to DM `#3ecf8e`), `.dark` class variant, `prefers-reduced-motion` reset, system font stack in `@theme`. `src/lib/fonts.ts` still names "Yekan Bakh" (dead leftover; not imported by the CSS).

### 2.5 Locale, text, messages

- `src/lib/locale.ts`: `en` profile (`timeZone: 'UTC'`, `weekStartsOn: 0`). `src/lib/format.ts` reads `locale.timeZone` as the date default (the one permitted reader besides `locale.ts`, TS-§4 rule 4).
- `src/lib/text/normalize.ts` **exists** (`normalizeDigits`, `normalizePersianChars`, `normalizeInput`, `toLocaleDigits`) with 14 unit tests — TS-§9's "restore `lib/persian.ts` as `lib/text/normalize.ts`" is already done.
- `src/messages/en.ts`: flat keys for shell, nav, auth, home, users, validation, errors, ui. `t()`/`tp()` in `src/lib/t.ts` are hook-free and typed on the dictionary; `{param}` names are inferred.

### 2.6 Tooling

- `eslint.config.mjs`: UI-primitive boundary + four `layer()` rules (components, app islands, route files, services, actions, lib). None of TS-§4's four added rules exist yet.
- `scripts/new-module.mjs`: scaffolds validation/service/action/page/island/test and inserts message keys before the `// ── Error boundary` marker in `src/messages/en.ts`. It writes pages to `src/app/<plural>/`, **not** `src/app/(app)/<name>/` — move the generated page into `(app)` by hand.
- `src/__tests__/setup.ts`: mocks `server-only`, `@/lib/env` (fixed values — extend when env grows), `next/navigation`, `next/headers`, `next/cache`, `@/lib/prisma` (deep mock), `@/lib/logger`. Factories: `user`, `session` (fishery + faker).
- `e2e/`: `auth.spec.ts` expects the `home.title` heading on `/`; `locale.spec.ts` asserts an `<aside>` sidebar on `/` and `/components`; `helpers/auth.ts` logs out through `data-testid="user-menu"`. All three break when the shell is replaced (phase 3 fixes them).
- `.github/workflows/ci.yml`: `quality` (lint:all, test:coverage, build), `e2e` (Postgres 16 service, seed, Playwright), `docker` (build + smoke). No integration project, no registry push, no deploy.
- `Dockerfile`: `node:lts-slim` from Docker Hub (TS-§13 wants `hub.hamdocker.ir/library/`), no `postgresql-client`, no `TZ=UTC`. `docker-entrypoint.sh` runs `migrate deploy` then `node server.js`.
- `.claude/settings.json` allows npm/prisma/bd/docker-compose commands and denies destructive Prisma and force-push.
- Bundled Next docs confirm the APIs this plan relies on: `instrumentation.ts` `register()` with the `NEXT_RUNTIME === 'nodejs'` guard (`node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`), `after()` from `next/server` (`.../04-functions/after.md`), `serverActions.bodySizeLimit` (`.../serverActions.md`).

### 2.7 Beads

`.beads/` is initialised; `bd list` returns no issues. `bd ready` is empty.

## 3. Conflicts, gaps, and how this plan resolves them

Each row names the sources, the consequence for implementation, and the resolution. **RESOLVED** =
build as stated; the specs were edited on 2026-09-17 where a row says so. **DEFAULT** = build as
stated; it is a planning-time default listed in `docs/PRD.md` › "Defaults awaiting owner review".

### 3.1 Spec ↔ spec

| #   | Where                                                                                                                                                                                                               | Conflict                                                                                                                                                                 | Consequence                                                              | Resolution                                                                                                                                                                                                                                                                     | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| C1  | PS-§11 "the only email the product sends is the transactional password-reset message"; PS-§15 "The recovery email, when supplied…"; PS-§17 checklist "no email other than the transactional password-reset message" | Leftovers from v1.6 contradicting PS-§1 v1.7 decisions, TS-§0.1, and decision 008 (no email of any kind)                                                                 | An agent reading only §11/§15/§17 might build a reset path               | v1.7 header + TS-§0.1 + decision 008 win: **no email, no reset, no recovery email column**. Product spec §11/§15/§17 should be edited to remove the three sentences (owner of the spec, not this plan)                                                                         | RESOLVED |
| C2  | PS-§9 essential states and TS-§22 mention a "plan ended" state; PS-§17 lists "plan-ended" among Today states                                                                                                        | Plans have no end date under decision 017; TS-§22 says the state was removed                                                                                             | No "plan ended" banner exists to build                                   | Do not build a plan-ended state. Today states are: no plan, import pending/ready/failed, time-zone changed, ongoing/past/incomplete/empty, loading, error                                                                                                                      | RESOLVED |
| C3  | PS-§8 "the earliest consumed time is used for order and timing" vs. PS-§8 "A meal belongs wholly to the date the user chose" and TS-§19.11                                                                          | None in effect: both agree after v1.7                                                                                                                                    | —                                                                        | Build TS-§5 `Meal.dayRecordId` + `consumedLocalTime` (nullable); no cross-midnight split                                                                                                                                                                                       | RESOLVED |
| C4  | DM "Touch targets ≥ 36×36px", "Form fields 36px minimum" vs. PS-§12 "at least 44 × 44 CSS-pixel touch areas for primary controls"                                                                                   | Product spec owns usability targets; design.md is a generic token sheet                                                                                                  | Buttons and tappable rows must be 44px                                   | Use 44px minimum for primary controls and list rows; DM's 36px applies to nothing in this product                                                                                                                                                                              | RESOLVED |
| C5  | DM is a Supabase-inspired marketing token sheet (hero, pricing, footer, code blocks); PS-§12/§17 expect `design.md` to name a component system and product screens                                                  | DM supplies tokens (emerald primary, ink greys, Inter/Geist, 6px buttons, 12px cards, spacing scale, elevation) and nothing about the 12 product components or dark mode | Visual acceptance (PS-§17 last item) cannot be fully verified against DM | Component system = the existing local shadcn kit (decision 004). Map DM tokens onto `globals.css` variables (phase 3). Dark-mode palette: derive from DM `canvas-night` `#1c1c1c` / `on-dark`, keep the current `.dark` structure. Record the mapping in a decision note (019) | DEFAULT  |
| C6  | PS-§7 meal photo formats "JPEG, PNG, WebP, or HEIC" and "Convert HEIC" vs. TS-§11 / decision 011 (device converts HEIC; server rejects HEIC with 415)                                                               | Same outcome for the user; construction detail differs                                                                                                                   | —                                                                        | Build TS-§11 (device-side `heic-to`, server accepts JPEG/PNG/WebP by magic bytes)                                                                                                                                                                                              | RESOLVED |
| C7  | PS-§6 "Product defaults" say weekly rule periods "start on the first weekday the plan lists, otherwise Saturday"; `src/lib/locale.ts` `en.weekStartsOn: 0`                                                          | Locale profile is never the source of week start (decision 009)                                                                                                          | Nothing may read `locale.weekStartsOn` for product logic                 | `Profile.weekStart` per TS-§5; add it to the lint rule that already forbids reading `locale.timeZone` (TS-§4 rule 4) — extend the rule to `weekStartsOn`                                                                                                                       | RESOLVED |
| C8  | PS-§8 rubric weights, thresholds, checked-by-default coverage handling, added-item rules, dashboard composition (PS-§18)                                                                                            | Owner has not reviewed; spec says build them as defaults                                                                                                                 | Score ships behind `RUBRIC_VERSION = 'v1'`                               | Build as specified; keep every number in one constants file `src/lib/rubric/constants.ts`                                                                                                                                                                                      | DEFAULT  |
| C9  | TS-§10.1 says models default `deepseek-flash` and "the exact request field that disables thinking is confirmed in setup step 2"; PS-§13 names `deepseek-v4-flash-vision-exp`                                        | Model names are environment values, not code                                                                                                                             | Adapter must not hardcode a model                                        | `AI_MODEL_TEXT` / `AI_MODEL_VISION` env with TS-§14 defaults; thinking-off field read from a single constant set after the runbook records it                                                                                                                                  | RESOLVED |
| C10 | TS-§7 error code list has no `TOO_MANY_ATTEMPTS`, `USER_NOT_FOUND` etc. that the boilerplate already uses                                                                                                           | Two vocabularies                                                                                                                                                         | —                                                                        | Keep boilerplate codes; add TS-§7 codes for new services. Codes are `ServiceError.code` strings, not an enum                                                                                                                                                                   | RESOLVED |

### 3.2 Spec ↔ repository

| #   | Where                                                                                                                                                                         | Gap                                                                                                                                | Resolution                                                                                                                                                                                                                                                               | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| R1  | `User.fullName` is required; sign-up collects only username and password (PS-§5); display name lives on `Profile.displayName` (TS-§5)                                         | `signUpAction` cannot satisfy the column                                                                                           | Migration makes `fullName` nullable; the Users admin table shows `fullName ?? username`; `AuthUser.fullName` becomes `string \| null`; greeting reads `Profile.displayName ?? username`. Admin create form keeps `fullName` as optional. Decision 008 amended 2026-09-17 | RESOLVED |
| R2  | Admin username rule (`[a-z0-9._-]`, ≤32) vs. sign-up rule (`[A-Za-z0-9_]`, ≤30, case-insensitive unique)                                                                      | Two grammars; `citext` uniqueness applies to both once added                                                                       | New `lib/validations/account.ts` owns the sign-up rule. Admin rule stays (ops tool). `usernameLower` is derived in the service for both paths so uniqueness is one rule                                                                                                  | RESOLVED |
| R3  | `TIMESTAMP(3)` columns vs. TS-§3 `@db.Timestamptz(3)` everywhere                                                                                                              | First product migration alters `users` and `sessions` column types (CI migration-safety check in TS-§15 would flag a type change)  | Type change in migration `0002` with a `-- decision: 016` comment; decision 016 amended 2026-09-17. Postgres converts `timestamp` → `timestamptz` assuming session zone; the container runs `TZ=UTC`, and local dev must run the migration with `PGTZ=UTC`               | RESOLVED |
| R4  | No `directUrl`, no `citext`/`pgcrypto`, no `previewFeatures`                                                                                                                  | Supabase pooler needs `directUrl`; `usernameLower citext` needs the extension                                                      | `datasource db { url = env("DATABASE_URL"); directUrl = env("DIRECT_DATABASE_URL") }`; `generator client { previewFeatures = ["postgresqlExtensions"] }` + `extensions = [citext]`; migration `0002` starts with `CREATE EXTENSION IF NOT EXISTS citext;`                | RESOLVED |
| R5  | Session default 7 days vs. TS-§8/§19.7 90 days                                                                                                                                | Env default only                                                                                                                   | `env.ts` default `90`; `.env.example` updated                                                                                                                                                                                                                            | RESOLVED |
| R6  | Theme: two-state dark/light, default dark, localStorage only; product wants System/Light/Dark, default System, persisted per account, no flash (PS-§12)                       | Replace `lib/theme.ts` and the inline script                                                                                       | Phase 3 task 3.3: cookie `appearance` (server-rendered class) + `Profile.appearance`; inline script resolves `system` through `matchMedia`                                                                                                                               | RESOLVED |
| R7  | `Permissions-Policy: camera=()` in `next.config.ts` blocks camera capture for photo logging                                                                                   | `<input type="file" capture>` still works on mobile without the Permissions-Policy camera feature (it does not use `getUserMedia`) | Leave as is; phase 9 verifies on a real device. If capture fails, allow `camera=(self)` and note it                                                                                                                                                                      | RESOLVED |
| R8  | `scripts/new-module.mjs` writes to `src/app/<plural>/` not `(app)`                                                                                                            | Scaffold output must be moved                                                                                                      | Use the scaffold for validation/service/action/test, move the page into `src/app/(app)/<route>/`. Do not modify the script in this project (boilerplate tooling)                                                                                                         | RESOLVED |
| R9  | `e2e/locale.spec.ts` asserts `<aside>`; `auth.spec.ts` asserts `home.title` on `/`; `helpers/auth.ts` uses `user-menu`                                                        | Shell replacement breaks them                                                                                                      | Phase 3 rewrites the three specs against the bottom-tab shell and `/today`                                                                                                                                                                                               | RESOLVED |
| R10 | `src/lib/fonts.ts` (Yekan Bakh) and `prisma/seed.ts` Persian `fullName` are leftovers                                                                                         | Cosmetic                                                                                                                           | Phase 1 deletes `fonts.ts` (unused; also listed in `vitest` coverage excludes — remove that entry) and sets the seed name to `'Administrator'`                                                                                                                           | RESOLVED |
| R11 | `vitest.config.mts` coverage excludes `src/lib/i18n.ts` which does not exist                                                                                                  | Harmless                                                                                                                           | Remove the stale entry when touching the file                                                                                                                                                                                                                            | RESOLVED |
| R12 | Logger redaction covers password/token only; TS-§16 wants `*.originalText`, `*.originalName`, `*.sourceText`, `*.paragraph`, `*.notes`, `*.description`, `*.text`, `req.body` | Health content could reach Loki                                                                                                    | Phase 1 extends `logger.ts` redact paths before any health data model exists                                                                                                                                                                                             | RESOLVED |
| R13 | Dockerfile base `node:lts-slim` from Docker Hub; no `postgresql-client`; no `TZ`                                                                                              | Darkube pulls only through `hub.hamdocker.ir`; backups need `pg_dump`                                                              | Phase 11                                                                                                                                                                                                                                                                 | RESOLVED |
| R14 | `date-fns` installed but unused; TS-§3 adds `@date-fns/tz` for zone-aware day bounds                                                                                          | `lib/time` could use `Intl.DateTimeFormat` with `timeZone` parts and avoid the dependency                                          | Use `@date-fns/tz` (`TZDate`) as the tech spec says; it is the boilerplate's date library. Keep `@/lib/format` for display                                                                                                                                               | RESOLVED |

### 3.3 Operator inputs and delegated decisions — all decided on 2026-09-17

Nothing here blocks development. Items the operator must still _measure_ have a default that
applies until the runbook records the measurement (`docs/runbook.md` › "Measured values").

| #   | Item                                                                | Decision                                                                                                                           | Where recorded                   |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| O1  | Runbook steps 1–2 (Supabase, Darkube, `R`, ingress timeout, egress) | Operator work in phase 0; defaults: `R` = 150 ms, ingress timeout ≥ 60 s (meal analysis stays a server action), body limit ≥ 10 MB | runbook "Default until measured" |
| O2  | Supabase region                                                     | `eu-central-1`                                                                                                                     | TS-§19.1                         |
| O3  | Photo logging at release                                            | Built in phase 9; `PHOTO_LOGGING_ENABLED=false` in production until the eval passes TS-§19.4                                       | TS-§14, PRD defaults             |
| O4  | Rubric v1 numbers, dashboard composition                            | Build as PS-§8/§9; constants in `src/lib/rubric/constants.ts`                                                                      | PRD defaults                     |
| O5  | Visual language                                                     | Product name `Dietyaar`; placeholder logo stays; tokens per decision 019                                                           | decision 019                     |
| O6  | Domain                                                              | `dietyaar.darkube.app`; `APP_URL` set accordingly                                                                                  | TS-§19.3                         |
| O7  | Nutrition accuracy threshold                                        | No numeric claim anywhere in UI or copy; "Estimated" labels only; the eval harness reports numbers for the owner                   | PS-§13, TS-§10.5                 |
| O8  | DeepSeek thinking-off request field                                 | `thinking: { type: 'disabled' }`                                                                                                   | TS-§10.1, runbook                |
| O9  | Sentry vs. CSP                                                      | Sentry tunnel route `/monitoring`; CSP `connect-src 'self'`                                                                        | TS-§8                            |
| O10 | Scheduler in e2e                                                    | `SCHEDULER_ENABLED=true` in e2e (import journeys need it)                                                                          | TS-§14                           |
| O11 | AI evaluation meal set (40 Persian descriptions)                    | Agent seeds it from the two reference plans' foods, marked `reviewed: false`; the owner reviews before release thresholds are read | task 11.5                        |
| O12 | Postgres major version for `postgresql-client`                      | 17 until the runbook says otherwise                                                                                                | runbook                          |

### 3.4 Structural choices fixed at planning time

- Product pages live in `src/app/(app)/(shell)/`; `src/app/(app)/onboarding/` is outside the shell; `(app)/layout.tsx` only authenticates.
- No theme toggle in the top bar; appearance is set in Settings › Preferences only.
- Meal editing is in place through `updateMealAction` with `MealReview` in "edit" mode; no separate edit draft.
- The common-password list is SecLists `10k-most-common.txt` (MIT), vendored with its licence line.
- `ServiceError` gains `details`; `ActionResult` gains `code` and `details` (section 7 "Revisions").

## 4. Requirement map

The specs carry no requirement IDs. Planning IDs below are stable for this plan; each maps to the
owning document and section. Phases in section 5 cite these IDs. Do not edit the specs to add
them.

| ID    | Requirement (short)                                                                                                           | Source                                  | Phase        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------ |
| ACC-1 | Sign-up: username 3–30 `[A-Za-z0-9_]` case-insensitive unique; password 8–64, ≤72 B, not common; "no recovery" line           | PS-§5 flow 1, TS-§8, DS-1               | 2            |
| ACC-2 | Sign-in, throttle, sessions 90 d, no recovery path anywhere                                                                   | PS-§5, TS-§8, decision 008              | 2            |
| ACC-3 | Password change revokes other sessions; Settings › Account                                                                    | TS-§7, DS-8                             | 10           |
| ACC-4 | Account deletion: typed confirm, revoke, cancel jobs, purge in 7 d                                                            | PS-§15, TS-§7/§12, DS-8, J14            | 10           |
| ACC-5 | Under-18 stop: no Profile row, one-tap delete                                                                                 | PS-§5 eligibility, TS-§21.15            | 2            |
| ONB-1 | One question per screen: age, sex, height, weight, time zone, name, plan; resumable                                           | PS-§5 flow 2–5, DS-2, J1                | 2            |
| ONB-2 | Unit toggles convert without reinterpretation; Persian/Arabic digits accepted                                                 | PS-§5 acceptance                        | 2            |
| ONB-3 | AI-processing notice once per kind (plan, meal text, meal photo), manual alternative                                          | PS-§15, PS-§5, PS-§7, DS-2/4            | 4, 6         |
| ONB-4 | "I don't have a plan yet" → limited Today with "Add your plan"                                                                | PS-§5, PS-§9, J13                       | 4, 7         |
| PLN-1 | Import job: 20,000-char limit, background job, 15 s continue, Today banner states                                             | PS-§5 flow 3–4, PS-§6, TS-§12           | 4            |
| PLN-2 | Draft review: per slot/targets/rules, source excerpts, "Assumed", calorie-significant questions, weekday summary              | PS-§6 review rules, DS-2 8a–8c          | 4            |
| PLN-3 | Manual setup: same-every-day / by-weekday / targets-only                                                                      | PS-§6 supported inputs, DS-2            | 4            |
| PLN-4 | Confirm applies draft in one transaction; remap links by position; "N meals affected"                                         | PS-§6 editing, TS-§5, 017               | 4            |
| PLN-5 | AI-estimated baseline per option; explicit targets win per nutrient; "Sum of your meal ranges"                                | PS-§6, TS-§5.1                          | 4, 5         |
| PLN-6 | Rules: Track / Note / Ignore; untracked notes never evaluated                                                                 | PS-§6, PS-§8, DS-6                      | 4, 7         |
| PLN-7 | My plan page: read, edit, replace, delete                                                                                     | DS-6, J10                               | 4            |
| AI-1  | DeepSeek adapter: fetch + AbortSignal, JSON mode, zod, one retry rule, no persistence                                         | TS-§10.1, decision 012                  | 5            |
| AI-2  | Deadlines 120 s / 45 s / 15 s; per-user caps; global token budget                                                             | TS-§10.2, §10.4                         | 5            |
| AI-3  | Prompt-injection posture; `sourceExcerpt` substring check; no tool calls                                                      | TS-§8                                   | 5            |
| AI-4  | Eval harness `npm run ai:eval` (not in CI)                                                                                    | TS-§10.5                                | 11           |
| AI-5  | USDA secondary lookup behind flag, 30-day cache                                                                               | TS-§10.6, PS-§13                        | 5            |
| MEL-1 | Composer: text / photo / recent / planned / manual; date-time summary; "More details"                                         | PS-§7 main flow, DS-4                   | 6            |
| MEL-2 | Late-night prompt 00:00–04:00; backdated "Logging for [date]"; unknown time; no future                                        | PS-§7, TS-§5, J6, J11                   | 6            |
| MEL-3 | Server-held draft with `clientRequestId`, revisions, superseded analysis                                                      | TS-§5 MealDraft, TS-§21.8/9             | 6            |
| MEL-4 | Review: items, editable portions, totals (4 nutrients), sources, questions, restriction reminder, "Added" chip                | PS-§7 AI review, DS-4                   | 6            |
| MEL-5 | Planned meal with options: choose option first, "Last time" suggestion, no preselect                                          | PS-§7, DS-4, J2                         | 6            |
| MEL-6 | Save idempotent; `CONFLICT` on stale revision; edit/delete/reuse; photo remove                                                | PS-§7 confirmation, TS-§7               | 6            |
| MEL-7 | Meal details page; change plan link                                                                                           | DS-5                                    | 6            |
| DAY-1 | Day completeness checkbox (two-state, default checked), skipped slots                                                         | PS-§8 day completeness, TS-§5           | 7            |
| DAY-2 | Comparison on read: matchSlot, portion, energy, time/order, scoreSlot, scoreDay, coverage, "complete by default"              | PS-§8, TS-§6, decision 013              | 1, 7         |
| DAY-3 | Nutrition subtotals with incomplete flag; target comparison table                                                             | PS-§8 nutritional comparisons           | 1, 7         |
| DAY-4 | Rule observations (serving count, distinct groups, named weekday food)                                                        | PS-§8 variety, TS-§6                    | 1, 7         |
| TDY-1 | Today: header, import banner, reflection, plan block (score, Why, slot rows, nutrition details), recorded meals, completeness | PS-§9, DS-3                             | 7            |
| TDY-2 | Today states: no plan, no records, target-only, tz changed, loading, error                                                    | PS-§9 states, DS-3                      | 7            |
| HIS-1 | History: seven-day summary sentence with denominators; day rows; date picker; day view                                        | PS-§10, DS-7, J6/J9                     | 7            |
| REF-1 | Morning message: claim protocol, 15 s fallback, deterministic fallback states, single flight                                  | PS-§11, TS-§10.3, §21.11–12             | 8            |
| REF-2 | Staleness by fact bands; Update reflection; collapse per date                                                                 | PS-§11, TS-§6, §21.13                   | 8            |
| PHO-1 | Device conversion (heic-to, canvas 2048/0.85); `POST /api/uploads` (sharp, magic bytes, semaphore)                            | TS-§11, decision 011                    | 9            |
| PHO-2 | `GET /api/photos/[id]?s=tag` owner-checked, account-bound cache; `DELETE /api/uploads/[id]`                                   | TS-§7, §21.16                           | 9            |
| PHO-3 | `PHOTO_LOGGING_ENABLED` flag hides the photo action; `PHOTO_DISABLED` server-side                                             | PS-§7, TS-§14                           | 6, 9         |
| SET-1 | Settings: profile, preferences (units, tz, week start, appearance), account, privacy                                          | DS-8, PS-§4                             | 10           |
| SET-2 | Export zip `GET /api/export`                                                                                                  | PS-§15, TS-§7                           | 10           |
| SHL-1 | Bottom tabs Today · History · My plan; profile button; persistent Log meal                                                    | PS-§4, DS nav                           | 3            |
| SHL-2 | Appearance System/Light/Dark, no flash, persisted per account                                                                 | PS-§12, TS-§7 `updatePreferencesAction` | 3            |
| SHL-3 | Shared product components (12) under `components/product/`                                                                    | PS-§12, DS shared components            | 3, 6, 7      |
| SHL-4 | WCAG 2.2 AA, 44 px targets, reduced motion, bidi isolation                                                                    | PS-§12, TS-§9                           | 3+           |
| JOB-1 | Scheduler under `JobLock` lease; tasks: import, cleanup, purge, prune, backup                                                 | TS-§12, decision 010                    | 4, 9, 10, 11 |
| OPS-1 | `/api/live`; CSP; Origin check on mutating routes; Sentry scrubber; Loki redaction                                            | TS-§8, §13, §16                         | 1, 9, 11     |
| OPS-2 | Dockerfile (hamdocker mirror, pg client, TZ); CI integration + mobile e2e + docker push + darkube deploy                      | TS-§13, §15, decision 014               | 11           |
| OPS-3 | Backup task to Hamravesh; `npm run db:backup`; restore rehearsal                                                              | TS-§12, decision 018                    | 11           |
| DAT-1 | Schema for TS-§5 (15 tables) with indexes, timestamptz, citext, cascade                                                       | TS-§5                                   | 1            |
| LNT-1 | Four added layering rules + `locale.timeZone/weekStartsOn` reader rule + product RTL check                                    | TS-§4, TS-§9                            | 1            |
| ANA-1 | `AnalyticsEvent` with PS-§16 names, operational metadata only                                                                 | PS-§16, TS-§5                           | 6–8          |

## 5. Phases and tasks

Each task lists: files it creates or changes, what it must do (with spec references), tests, and a
beads issue title. Priorities: P1 = on the critical path, P2 = required for release, P3 = release
hardening. Phase numbering matches `docs/PRD.md` › Roadmap.

Conventions for every task (from `AGENTS.md`, not repeated below): new server-only modules import
`'server-only'`; services take `ownerId` first and scope every root query by it (TS-§8); every
action authorises then `safeParse`s then calls one service then `revalidatePath`; strings via
`t()`; numbers/dates via `@/lib/format`; logical CSS utilities only; icon-only buttons carry
`aria-label`; every new string is a key in `src/messages/en.ts`.

### Phase 0 — Setup checklist (blocks production deployment only)

Owner/operator work from TS-§13 and `docs/runbook.md`. It does **not** block local development of
phases 1–10: the local Docker Postgres and a stub AI server cover everything except the measured
values. What phases 5 and 11 read from the runbook is listed in section 3.3 O1.

| Task | Beads title                                                                  | Output                                                                                                     |
| ---- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0.1  | `Runbook: create Supabase project, bucket, role, Darkube app, backup bucket` | Runbook step 1 row filled. Secrets stay outside the repo                                                   |
| 0.2  | `Runbook: measure R, ingress timeout, DeepSeek/USDA egress from Darkube`     | Runbook step 2 + "Measured values" table. If Supabase is unreachable, apply TS appendix A (no code change) |

P2. Owner-facing; the agent prepares commands, the operator runs them.

### Phase 1 — Foundations (schema, pure libraries, env, lint) — P1

Goal: everything later phases depend on, with no UI. After this phase `prisma migrate dev` has
produced `0002_dietyaar_core`, `lib/rubric` and `lib/time` pass their fixture suites, and the four
new lint rules fail on a deliberate violation.

**1.1 Env, logger, lint rules** — `Foundations: env additions, logger redaction, layering lint`

- `src/lib/env.ts`: add every TS-§14 variable with its default and `booleanString` for flags:
  `APP_URL` (url, required), `DIRECT_DATABASE_URL` (url, optional in dev — falls back to
  `DATABASE_URL`), `S3_*` (optional until phase 9; validate as a group: all or none),
  `BACKUP_S3_*`, `BACKUP_ENABLED` (default true), `BACKUP_RETENTION_COUNT` (14),
  `STORAGE_SOFT_LIMIT_BYTES` (734003200), `DEEPSEEK_API_KEY` (optional in dev/test so the app boots
  without it; phase 5 returns `AI_UNAVAILABLE` when absent), `AI_MODEL_TEXT`/`AI_MODEL_VISION`
  (`deepseek-flash`), `DEEPSEEK_API_BASE_URL`, `AI_DAILY_TOKEN_BUDGET` (5_000_000), `PHOTO_LOGGING_ENABLED` (false),
  `USDA_LOOKUP_ENABLED` (false), `USDA_API_KEY`, `SENTRY_DSN`, `SCHEDULER_ENABLED` (true),
  `SESSION_MAX_AGE_DAYS` default → 90 (R5). Mirror every key in `.env.example` with a comment. In the same task set `APP_URL` and `DIRECT_DATABASE_URL` everywhere a build or a CLI already sets `DATABASE_URL`: `.github/workflows/ci.yml` (quality build env, e2e env, docker smoke `-e`), `Dockerfile` builder `ENV`, `docker-compose.yml` `web.environment`, `src/__tests__/setup.ts`. Prisma reads `directUrl` from the environment on every CLI command, so a code-side fallback is not enough (review finding 14).
- `src/__tests__/setup.ts`: extend the `@/lib/env` mock with the new keys (flags false, budget
  values as defaults) so existing tests keep passing.
- `src/lib/logger.ts`: extend `redact.paths` with the TS-§16 list (R12).
- `eslint.config.mjs`: add TS-§4 rules 1–4 using the existing `layer()` helper:
  1. `src/services/ai/**` → forbid `@/lib/prisma`.
  2. `src/lib/rubric/**`, `src/lib/time/**`, `src/lib/text/**` → forbid `@/services/*`, `@/lib/prisma`, `@prisma/client` (type imports allowed).
  3. `src/components/product/**` → forbid `@/actions/*`.
  4. Everything except `src/lib/locale.ts` and `src/lib/format.ts` → forbid reading `locale.timeZone` / `locale.weekStartsOn`. `no-restricted-imports` cannot see member access; implement as `no-restricted-syntax` with selectors `MemberExpression[object.name='locale'][property.name=/^(timeZone|weekStartsOn)$/]` on `src/**` with those two files ignored.
  5. TS-§9 reduced RTL check: `no-restricted-syntax` on `src/components/product/**` for JSX `className` literals containing `text-left`/`text-right` (a `Literal[value=/\btext-(left|right)\b/]` selector is enough).
- Delete `src/lib/fonts.ts`; remove it and `src/lib/i18n.ts` from `vitest.config.mts` coverage excludes (R10, R11). `prisma/seed.ts` → `fullName: 'Administrator'`.
- Tests: `src/__tests__/lib/env.test.ts` is not possible (module is mocked); instead add a
  `scripts/`-free check: a unit test that imports `eslint.config.mjs` is overkill — verify the
  rules manually with `npx eslint` on a throwaway file during the task and mention it in the report.

**1.2 Schema and migration 0002** — `Foundations: Prisma schema for tech-spec §5 (15 tables)`

- `prisma/schema.prisma`: add `directUrl`, `previewFeatures = ["postgresqlExtensions"]`,
  `extensions = [citext]` (R4); every `DateTime` → `@db.Timestamptz(3)` including `User`/`Session`
  (R3); `User.fullName String?` (R1); `User.usernameLower String @unique @db.Citext`,
  `deletionRequestedAt`, `deletionScheduledFor`, `onboardingStep OnboardingStep @default(AGE)`
  with the TS-§5 enum; then the models exactly as TS-§5 names them: `Profile`, `Plan`, `PlanSlot`,
  `PlanOption`, `PlanItem`, `PlanTarget`, `PlanRule`, `PlanNote`, `PlanImportJob`, `DayRecord`,
  `DaySkippedSlot`, `Meal`, `FoodItem`, `Upload`, `MealDraft`, `MorningMessage`, `AiCall`,
  `AnalyticsEvent`, `FoodDataCache`, `JobLock`. Enums as listed in TS-§5 (`Sex`, `UnitSystem`,
  `Appearance`, `PlanStatus`, `PlanStructure`, `DraftKind`, `TargetNutrient`, `TargetType`,
  `TargetSource`, `RuleKind`, `RuleTracking`, `RulePeriod`, `NoteReason`, `ImportJobStatus`,
  `MealInputKind`, `FoodCategory`, `UploadStatus`, `AnalysisStatus`, `MessageStatus`,
  `FallbackState`, `AiCallKind`, `AiOutcome`). Quantities `Decimal @db.Decimal(10, 2)`; JSON
  columns `Json`. Table names `@@map` in snake_case like the boilerplate (`users`, `sessions`).
- Nullable columns never take part in a unique key (PostgreSQL treats NULLs as distinct; review finding 2): `PlanSlot.weekday Int` is **not null** with `7` meaning "every day" (same-every-day and targets-only plans); `PlanTarget` gets a non-null `scopeKey String` = `` `${weekday}:${planSlotId ?? 'day'}:${nutrient}` `` derived in the service, unique per plan. Uniques and indexes per TS-§5 "Indexes beyond foreign keys" plus `@@unique([planId, weekday, position])` on `PlanSlot`, `@@unique([planId, scopeKey])` on `PlanTarget`, `@@unique([userId, localDate])` on `DayRecord` and `MorningMessage`, `@@unique([dayRecordId, planSlotId])`, `Meal.clientRequestId @unique`, `MealDraft.clientRequestId @unique`, `JobLock.name @unique`, `FoodDataCache.queryKey @unique`, partial index on `User(deletionScheduledFor)` — Prisma cannot express `WHERE … IS NOT NULL`; add it by hand in the migration SQL.
- Cascades: every `userId` relation `onDelete: Cascade`; child rows cascade through their parent; `Meal.planSlotId` / `planOptionId` and `FoodItem.matchedPlanItemId` use `onDelete: SetNull` (this is what makes "slot removed → Other" and "option removed → Needs review" fall out of the database, TS-§5 "Applying a draft").
- Migration (review finding 1): `npx prisma migrate dev --create-only --name dietyaar_core`, then edit
  `prisma/migrations/0002_dietyaar_core/migration.sql` **before** applying: begin with `SET lock_timeout = '5s';` and
  `CREATE EXTENSION IF NOT EXISTS citext;`; make the `users`/`sessions` timestamp conversions explicit (`ALTER TABLE … ALTER COLUMN … TYPE timestamptz(3) USING … AT TIME ZONE 'UTC'`, so the result does not depend on the session zone); add `usernameLower` as nullable, `UPDATE users SET "usernameLower" = lower(username)`, then `ALTER … SET NOT NULL` and the unique index; add the partial index on `deletionScheduledFor`; then `npx prisma migrate dev` applies it. Test the migration twice: on an empty database and on one seeded with the boilerplate admin. Commit it.
- `src/__tests__/factories/`: add `profile`, `plan` (+slot/option/item/target/rule/note), `dayRecord`, `meal`, `foodItem`, `mealDraft`, `morningMessage` factories; update `user.factory.ts` for the new columns. Export from `factories/index.ts`.
- Tests: `npm run test` still green; `npx prisma validate`; `npx prisma migrate status` clean locally.

**1.6 Integration test project** — `Foundations: Vitest integration project against real Postgres`

- `vitest.config.mts` `projects`: `unit` (today's config) and `integration` (`src/__tests__/integration/**/*.test.ts`, no Prisma mock, `DATABASE_URL` from env, each file runs in a transaction-per-test or truncates its tables). `npm run test:integration`; CI job `integration` added in this task (Postgres service like the e2e job), not in phase 11. Every later module adds its concurrency/idempotency tests here as it is built (review finding 15): 4.1 job claim, 4.2 confirm remap, 6.2 double save and `CONFLICT`, 8.1 single flight.
- PRD: move the "Planned" data model lines to "Built today".

**1.3 `lib/time`** — `Foundations: lib/time day boundaries and bands`

- Install `@date-fns/tz` (TS-§3). Files: `src/lib/time/local-date.ts` (`localDateFor(instant, zone): string` ISO date, `dayBounds(localDate, zone): {start, end}`, `isLateNightWindow(now, zone)` true for 00:00–03:59, `weekdayOf(localDate, zone)`), `src/lib/time/bands.ts` (`minutesBetween`, `timeBand(diffMinutes)` → `SMALL|NOTICEABLE|LARGE` at 60/120 inclusive). All functions take `now`/zone explicitly (decision 009).
- Tests: `src/__tests__/lib/time/*.test.ts` — DST transitions in `Europe/Berlin`, `Asia/Tehran` (no DST since 2022), midnight edges (TS-§21.5), 03:59 vs 04:00 (TS-§21.6), 60 and 120 minute boundaries. 95% statement coverage on `lib/time` (TS-§15) — add a per-directory threshold in `vitest.config.mts`.

**1.4 `lib/rubric`** — `Foundations: lib/rubric pure comparison and scoring`

- `src/lib/rubric/constants.ts`: `RUBRIC_VERSION = 'v1'`, weights 50/30/20, day 90/10, portion 0.15/0.30, energy 0.10, time 60/120, bands 85/60, `CALORIE_SIGNIFICANT = ['OIL','BREAD','RICE','POTATO','NUTS','DAIRY','MEAT']`, `NEVER_COUNTED = ['VEGETABLE','HERB','CONDIMENT']` (PS-§8, C8).
- `src/lib/rubric/types.ts`: plain-object inputs (no Prisma types): `RubricItem {name, englishLabel, quantity: number|null, unit, category, matchedPlanItemId, isAdded}`, `RubricOption`, `RubricSlot`, `DayInput {localDate, zone, dayPhase, logComplete, slots, meals, skippedSlotIds, targets, rules}`.
- Functions, one file each, signatures from TS-§6 table: `match-slot.ts` (`matchSlot`), `portion.ts` (`portionResult`), `energy.ts` (`energyResult`), `timing.ts` (`timeResult`, `orderResult`), `score.ts` (`scoreSlot`, `scoreDay`), `nutrition.ts` (`nutritionSubtotals`, `compareTarget`), `rules.ts` (`ruleObservation`), `restrictions.ts` (`restrictionHits` using `normalizeInput` from `lib/text`), `facts.ts` (`reflectionFacts`, `isReflectionStale`), `seven-day.ts` (`sevenDaySummary`), `day-view.ts` (`computeDayView(input): DayView` orchestrating steps 1–8 of TS-§6 "Calculation order").
- Rules that must be encoded exactly (PS-§8): raw vegetables/herbs without quantity never count toward matching; in-item alternatives count as present for either; cross-slot option → Partly matched with reason `CROSS_SLOT` and no credit to the other slot; added calorie-significant item → Partly matched `ADDED`; "Other" (`planSlotId = null`) never matched; a slot with linked meals lacking a resolved option → `NEEDS_REVIEW`, excluded from score; skipped → coverage only; number shown only with ≥2 scored slots; nutrition component only when `PAST && logComplete && energyComplete`; `completeByDefault` when checked and any slot `NOT_RECORDED`; portion mean over counted matched items; unknown quantity/time → component excluded, never zero; boundaries inclusive (15% and 60 min are SMALL).
- Fixtures: `src/__tests__/fixtures/plans/menu-plan.ts` and `weekday-plan.ts` (the two owner-supplied Persian plans, typed as `RubricSlot[]` + targets + notes; keep original Persian names with English labels), `src/__tests__/fixtures/examples/*.ts` one per PS-§8 worked example, plus each row of the thresholds table at its boundary (PS-§8 acceptance). TS-§22 says three original examples were inconsistent and the spec now carries the corrected text; encode the corrected wording.
- Tests: `src/__tests__/lib/rubric/*.test.ts`; property-style test that `computeDayView` is deterministic for identical input (PS-§8 "reproducible"). 95% statement coverage on `lib/rubric`.

**1.5 `services/food-data` units and scaling** — `Foundations: household-unit table and nutrition scaling`

- `src/services/food-data/units.ts`: the PS-§6 table as data with a `source` note per row (glass 240 ml, cup 200 ml, tsp 5 ml, tbsp 15 ml, medium apple 180 g, small banana 100 g, date 8 g, sangak slice 80 g, "cucumber and tomato" 150 g, "large salad" 200 g, …) and `convert(quantity, from, to, density?)` that refuses unknown pairs (TS-§5.1 rule 1). Unit keys are the `unit` strings stored on `PlanItem`/`FoodItem`.
- `src/services/food-data/scale.ts`: `scaleNutrition(nutrition, newQuantity, newUnit)` implementing the five TS-§5.1 rules (`PER_100G` linear after conversion; `PER_RECORDED_PORTION` linear only for `AI_ESTIMATE|RECIPE`; identity/prep/unit change → `needsReestimate`; `userOverride` never scales → `checkValue`; `null` stays `null`).
- `src/lib/validations/nutrition.ts`: zod schema for the TS-§5.1 JSON shape (also used to validate AI output in phase 5).
- These two files are framework-free and Prisma-free; put them under `services/food-data/` as TS-§4 says but keep them importable from `lib/rubric` tests via plain values (rubric itself receives already-scaled numbers).
- Tests: conversion table, refusal, each scaling rule, three-decimal rounding.

### Phase 2 — Account and onboarding — P1

Depends on 1.1, 1.2. Delivers DS-1 and DS-2 screens 1–6 (7–9 arrive with phase 4). After this
phase a new user can sign up, answer the six profile questions, and land on a placeholder Today.

**2.1 Sign-up** — `Account: sign-up with username/password, common-password list, rate limit`

- `src/lib/common-passwords.ts`: top-10k list as a `Set<string>` (TS-§4) from SecLists `10k-most-common.txt` (MIT); origin and licence in a header comment. Keep it out of client bundles (`import 'server-only'`).
- `src/lib/validations/account.ts`: `signUpSchema` (username `^[A-Za-z0-9_]{3,30}$`, password `min(8).max(64)` + `refine(byteLength ≤ 72)` + `refine(not common)` — the common check runs server-side only; keep a client-safe schema without it for `zodResolver`), `changePasswordSchema`, `deleteAccountSchema` (typed username). Messages: `validation.username*`, `validation.passwordCommon`, `validation.passwordTooLong`.
- `src/services/account.service.ts`: `signUp(username, password)` → `USERNAME_TAKEN` via `usernameLower`; creates `User` with `fullName: null`, `onboardingStep: 'AGE'`. One normalisation rule everywhere (review finding 9): `usernameLower = username.trim().toLowerCase()` computed in the service on sign-up, admin create and seed; `authenticate` looks up `where: { usernameLower }` and keys the login throttle on the lowered value; `createUser` checks `usernameLower` for `USERNAME_TAKEN`; there is no username-change path (admin `updateUserSchema` is `{ fullName, role }`), and any future one must set both columns; opens a session (reuse `authenticate`'s session code — extract `openSession(userId)` from `auth.service.ts` and call it from both). `changePassword(ownerId, current, next)` revokes all sessions except the current token hash (needs `revokeOtherSessions(userId, keepTokenHash)`). `requestDeletion`, `deleteUnderageAccount` (phase 2.3/10).
- `src/actions/account.actions.ts`: `signUpAction` (`useActionState` shape like `loginAction`, sets the cookie, `redirect('/onboarding')`), rate-limited 10/IP/hour using `X-Real-Ip` (TS-§8) via a small in-process `src/services/rate-limit.service.ts` (sliding window map; reused by uploads and AI caps; decision 010 notes the table swap at >1 replica).
- `src/app/(auth)/signup/page.tsx` + `signup-form.tsx`: reuse the login form layout; add the one line `t('auth.signup.noRecovery')` = "A forgotten password can't be recovered in this release." (PS-§12). Login page gets a link to `/signup` and vice versa. `src/proxy.ts`: `PUBLIC_ROUTES = ['/login', '/signup']`.
- `src/lib/auth.ts` + `src/types/auth.ts`: `AuthUser.fullName: string | null`, add `onboardingStep`. `requireAuth` unchanged; add `requireOnboarded()` that redirects to `/onboarding` while `onboardingStep !== 'DONE'` — used by `(app)/(shell)/layout.tsx` and product pages, **not** by `(app)/layout.tsx`, `/admin` or `/components` (§3.4). Admin and seed accounts are created with `onboardingStep: 'AGE'` like everyone else, so a `DONE` user always has a complete `Profile` and the "DONE without profile" state cannot exist (review finding 8); an admin who opens `/today` simply goes through onboarding. `prisma/seed.ts` additionally creates an onboarded `demo` / `demo1234` user with a complete profile when `NODE_ENV !== 'production'`, which the product e2e specs log in as.
- Admin Users module: `users-table.tsx`/dialogs render `fullName ?? username`; `createUserSchema.fullName` optional; `createUser` sets `usernameLower`.
- Tests: `account.service.test.ts` (taken username case-insensitively, common password, 73-byte password rejected — TS-§21.17), `account.actions.test.ts`, update `auth.service.test.ts` for `openSession`, `validations.test.ts` for the new schema. e2e `e2e/signup.spec.ts`: sign up → lands on `/onboarding`; the no-recovery line is visible; taken username error.

**2.2 Onboarding flow** — `Onboarding: one question per screen with resume`

- `src/lib/validations/profile.ts`: per-step schemas (`age` int 18–120 after `normalizeDigits`; `sex` enum; `height` cm 100–250 or ft/in pair converted client-side; `weight` kg 30–300 or lb; `timeZone` validated by constructing `new Intl.DateTimeFormat('en', { timeZone })` in a try/catch (`Intl.supportedValuesOf('timeZone')` omits `UTC` and aliases — verified on Node 24; it is used only to populate the picker); `displayName` optional ≤40).
- `src/services/profile.service.ts`: `saveOnboardingStep(ownerId, step, values)`: age is validated and **never written** when < 18 (returns `UNDER_18`); an accepted age creates the `Profile` row at the `AGE` step with `ageYears` (this keeps TS-§5's invariant — an under-18 user never gets a row — and survives a refresh right after the first answer; review finding 8); `completedAt` set only when the five required fields exist; `User.onboardingStep` advances; `getOnboardingState(ownerId)` returns current step + saved values for resume. Units stored metric (`unitSystem` remembers the display choice, PS-§5 "unit changes convert existing values").
- Transition table (each row: step → what is persisted → next step). `AGE` → `Profile.ageYears` (row created) → `SEX`; `SEX` → `sex` → `HEIGHT`; `HEIGHT` → `heightCm` (+ `unitSystem`) → `WEIGHT`; `WEIGHT` → `weightKg`, `weightMeasuredAt = today` → `TIME_ZONE`; `TIME_ZONE` → `timeZone` → `DISPLAY_NAME`; `DISPLAY_NAME` → `displayName` or nothing, sets `completedAt` → `PLAN`; `PLAN` → import started / manual started / skipped → `REVIEW` (import or manual) or `DONE` (skipped, "I don't have a plan yet"); `REVIEW` → confirmed → `READY`, or "Continue to Today" while the import runs → `DONE` (Today shows the import banner and Review now returns to the review flow with `onboardingStep` already `DONE`); `READY` → `DONE`. `User.onboardingStep` is the single resume pointer; `getOnboardingState` returns it with the saved values. Today is reachable exactly when `onboardingStep = DONE`.
- `src/actions/profile.actions.ts`: `saveOnboardingStepAction(step, values)`, `deleteUnderageAccountAction` (only when `onboardingStep = AGE` and no Profile row; deletes the User row immediately — TS-§21.15).
- `src/app/(app)/onboarding/page.tsx` (server: `requireAuth`, `getOnboardingState`, renders the step) + `onboarding-flow.tsx` (client: one question per screen, `Progress` bar with a truthful step count, back navigation, autosave on Continue, mobile numeric keyboards `inputMode="decimal"`, unit toggle converting the displayed value, `dir="auto"` inputs). Screens per DS-2 rows 1–6; screen 7 ("Add your plan") renders a placeholder "Continue to Today" until phase 4 replaces it, and screen 9 ("Ready") is phase 4. An under-18 answer shows the stop screen with one-tap "Delete account" and no confirm loop.
- Time zone screen: detect with `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client; "Looks right" / "Change" (a `Select` of `Intl.supportedValuesOf('timeZone')`).
- Layout: `/onboarding` lives under `(app)` for `requireAuth` but must not show the product shell — give it its own `src/app/(app)/onboarding/layout.tsx` that renders bare, and make the product shell layout (phase 3) skip chrome when the pathname starts with `/onboarding`. The shell lives in a nested group `src/app/(app)/(shell)/layout.tsx`; `onboarding/` stays outside it; `(app)/layout.tsx` only runs `requireAuth` + `AuthProvider` (§3.4).
- Tests: `profile.service.test.ts` (under-18 leaves no Profile, resume returns saved values, completion refused without all five, metric conversion), `profile.actions.test.ts`. e2e `e2e/onboarding.spec.ts` (Pixel 7 project once phase 3 adds it; Desktop Chrome until then): full J1 up to the plan screen; refresh mid-way resumes; age 17 stops and deletes.

**2.3 Greeting and profile read model** — `Profile: display-name greeting and profile summary read`

- `profile.service.ts`: `getProfile(ownerId)` (for Today header, Settings, AI context); `greetingNameFor(profile, user)` = `displayName ?? username` (PS-§5 acceptance). Used by phase 7.
- Tests in `profile.service.test.ts`.

### Phase 3 — Product shell, appearance, shared components — P1

Depends on 2.1 (routes) and 1.1. Replaces the boilerplate sidebar shell (TS-§4 REPLACED).

**3.1 Bottom-tab shell** — `Shell: bottom tabs, profile button, persistent Log meal`

- `src/lib/navigation.ts`: replace `NAV_GROUPS` with `PRIMARY_TABS = [today, history, plan]` (icons from lucide), `SETTINGS_ITEM`, `ADMIN_ITEMS` (Users, Components — admin only, reachable from Settings › "Tools" rather than a tab). Keep `isNavItemActive`, `pageTitleFor` (tests in `navigation.test.ts` updated).
- `src/components/layout/`: delete `Sidebar.tsx`, `SidebarContext.tsx`, `Header.tsx`; delete `src/lib/preferences.ts` sidebar cookie (keep the file if `PREFERENCE_COOKIE_MAX_AGE` is reused for the appearance cookie — rename the constant). Add `BottomNav.tsx` (three tabs, `aria-current="page"`, 44 px targets, safe-area padding `pb-[env(safe-area-inset-bottom)]`), `TopBar.tsx` (page title, profile `IconButton` → `/settings`), `LogMealButton.tsx` (fixed above the bottom nav, opens the composer sheet; until phase 6 it opens an empty `Sheet side="bottom"` with `t('meal.compose.title')`). On `md+` viewports keep the same hierarchy (PS-§4: no extra reports), nav moves to a top row.
- `src/app/(app)/(shell)/layout.tsx`: `requireOnboarded()`, `AuthProvider`, skip link, `<main>` with bottom padding for the nav, `BottomNav`, `LogMealButton`. `src/app/(app)/page.tsx` → `redirect('/today')`. Placeholder pages `today/`, `history/`, `plan/` with their `t()` titles so navigation works end to end; `settings/` ships now with its Account section only (username, the no-recovery line, Log out) so the e2e logout helper has a real target; phases 4–10 fill the rest.
- Messages: `nav.today`, `nav.history`, `nav.plan`, `nav.settings`, `shell.logMeal`, `shell.profile`.
- e2e: rewrite `e2e/locale.spec.ts` (assert `<nav>` at the bottom on `/today`, no horizontal overflow), `e2e/auth.spec.ts` (`waitForURL('/today')`, heading `today.title`), `e2e/helpers/auth.ts` (logout via Settings › Log out). Keep `admin-users.spec.ts` working (`/admin/users` renders inside the shell; admin created by seed is onboarded).
- `e2e/playwright.config.ts`: add project `mobile` = `devices['Pixel 7']` with stored state, `testIgnore: /auth\.spec\.ts/`; run product specs in both `chromium` and `mobile` (TS-§15). Set `timezoneId` per test where the product needs it (default stays the profile zone).

**3.2 Design tokens** — `Shell: map design.md tokens onto globals.css`

- `src/app/globals.css`: primary from DM `#3ecf8e` (hue ≈ 153, sat ≈ 60%, light 53% — set `--brand-hue`/`--brand-saturation` and adjust `--primary` lightness so `--primary-foreground` becomes DM `on-primary` near-black `#171717` rather than white — check contrast ≥ 4.5:1), neutrals from DM ink/hairline ladder, radii `--radius` 6 px buttons / 12 px cards (shadcn kit reads `--radius`), dark surfaces from `canvas-night #1c1c1c` / `canvas-night-soft #202020`. Body font: system stack per TS-§9 (DM's Inter/Geist suggestion is optional; do not add a webfont for Persian glyph reasons). Keep the `prefers-reduced-motion` block. Transitions 150–250 ms (PS-§12).
- Add `@media (prefers-color-scheme: dark)` support: the `.dark` class stays the switch; the inline script (3.3) adds/removes it for `system`.
- Follow `docs/decisions/019-design-tokens-from-design-md.md` (written 2026-09-17).
- Verify in the browser (Playwright MCP) both themes on `/components`.

**3.3 Appearance System/Light/Dark** — `Shell: appearance preference with cookie and profile`

- Replace `src/lib/theme.ts` with a three-state store (`system|light|dark`), `resolveAppearance(pref, prefersDark)`. Root layout reads cookie `appearance` (server) → renders `class="dark"` only when resolved dark; the inline script handles `system` via `matchMedia` before paint and listens for changes. Signed-in users: `updatePreferencesAction({ appearance })` writes `Profile.appearance` **and** the cookie (TS-§7 note). On login, `loginAction`/`signUpAction` set the cookie from the profile so a new device follows the account.
- `ThemeToggle.tsx` is removed from the shell; the control lives in Settings › Preferences (phase 10) as a three-option `RadioGroup`; no toggle in `TopBar` (PS-§9 keeps Today minimal; §3.4).
- Tests: unit for `resolveAppearance`; e2e: no flash check is manual (Playwright MCP screenshot at first paint with `prefers-color-scheme: dark` emulation).

**3.4 Shared product components (skeletons)** — `Shell: components/product scaffolding for the 12 shared components`

- `src/components/product/`: create the twelve files named after DS "Shared components": `MealComposer.tsx`, `MealReview.tsx`, `PlanSlotRow.tsx`, `ScoreCard.tsx` (with `WhyThisScore`), `NutritionDetails.tsx`, `CompletenessCheckbox.tsx`, `ReflectionCard.tsx`, `DifferenceChip.tsx`, `NameLabel.tsx` (Original + English; wraps original in `<bdi>` and the label in an LTR span — the only place mixed-direction text is composed, TS-§9), `ImportStatusBanner.tsx`, `AiNoticeSheet.tsx`, `Disclosure.tsx` (the one expand/collapse pattern; build on a new `src/components/ui/collapsible.tsx` from `@radix-ui/react-collapsible` — add the package, export from the barrel, and add it to the `UI_PRIMITIVE_REGEX` allow-list in `components/ui` only).
- Each component takes data + callbacks via props (TS-§4 rule 3: no `@/actions` imports). Implement `NameLabel`, `DifferenceChip`, `Disclosure`, `AiNoticeSheet`, `ImportStatusBanner` fully now (they are small); the rest as typed props + minimal markup filled in phases 4–8. Add each to `/components` gallery page with Persian sample text.
- Add `src/components/ui/alert-dialog.tsx` (`@radix-ui/react-alert-dialog`) for delete confirmations (PS-§12 "concise confirmation naming the meal"); extend the primitive regex allow-list similarly.
- Tests: none at unit level (components are exercised by e2e); axe check on `/components` in phase 11.

### Phase 4 — Plan module (import job, draft review, manual, confirm) — P1

Depends on 1.2, 1.4, 1.5, 3.4, and on the AI adapter (5.1) for the real import; build the job
runner and the review UI against a fake `interpretPlan` first, then plug in 5.1.

**4.1 Scheduler and job runner** — `Jobs: instrumentation scheduler with JobLock lease`

- `src/instrumentation.ts`: `register()` guarded by `process.env.NEXT_RUNTIME === 'nodejs'` and `env.SCHEDULER_ENABLED`; dynamic-imports `@/services/jobs/scheduler`.
- `src/services/jobs/scheduler.ts`: TS-§12 lease loop — random `holder`, every 20 s `UPDATE "JobLock" … RETURNING` via `prisma.$executeRaw` (a plain row, pooler-safe; decision 010), `shouldStop` flag, tasks registered with cadence; on lost lease, stop scheduling. Seed the `JobLock` row lazily (`upsert` on `name = 'scheduler'`).
- `src/services/jobs/plan-import.job.ts`: claim with an atomic query (review finding 5) — `UPDATE plan_import_jobs SET status = 'RUNNING', attempt = attempt + 1, "heartbeatAt" = now(), "startedAt" = now() WHERE id = (SELECT id FROM plan_import_jobs WHERE status = 'QUEUED' OR (status = 'RUNNING' AND "heartbeatAt" < now() - interval '3 minutes') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED) AND status IN ('QUEUED', 'RUNNING') RETURNING id, attempt, "draftId"` via `prisma.$queryRaw` (`$executeRaw` only returns a count); table names are the snake_case `@@map` names. Finalize is one transaction: `UPDATE plan_import_jobs SET status = 'DONE' … WHERE id = $1 AND attempt = $2 AND status = 'RUNNING'` and, only if that affected one row, `UPDATE plans SET "draftJson" = $3 WHERE "userId" = $4 AND "draftId" = $5` — the job's `draftId` must still be the plan's current draft, so an import the user has since replaced can never overwrite the newer draft (review finding 6). Heartbeat every 20 s, 3 attempts then `FAILED`. Exposes `runJobsNow()` for `after()` from the start action; concurrent runners are safe because of `SKIP LOCKED`.
- Tests: unit with mocked `$executeRaw`/`$queryRaw`; integration project (phase 11) covers concurrency and lease takeover (TS-§21.7). Keep tasks under 10 minutes with checkpoint checks.

**4.2 Plan service: draft lifecycle** — `Plan: service for draft, confirm, remap, delete`

- `src/lib/validations/plan.ts`: `PlanDraft` zod schema = the TS-§10.2 import output shape (slots with weekday/position/originalName/englishLabel/timeStart/timeEnd/sourceExcerpt; options; items with quantity/unit/category/alternatives/nutrition/quantityAssumed; targets; rules with tracking; notes; uncertainties/questions), `draftRevision`, section-edit payloads for `updatePlanDraftAction`, `startManualPlanSchema` (structure + name), `sourceTextSchema` (≤ 20,000 chars after no normalization — the count is on the verbatim text).
- `src/services/plan.service.ts`: `getPlan(ownerId)` (active rows + draft state), `startImport(ownerId, sourceText)` (writes `draftSourceText` — the confirmed `sourceText` is untouched until confirm — sets `status = DRAFT_PENDING`, `draftKind = IMPORT`, a fresh `Plan.draftId = cuid()`, and inserts a `QUEUED` job carrying that `draftId`; every `startImport`/`startManual`/`startEdit` regenerates `draftId`, which is what the job finalize checks — review finding 6), `getImportStatus`, `retryImport`, `cancelImport`, `startManual(ownerId, structure, name)`, `updateDraft(ownerId, section, payload, draftRevision)` (optimistic on a `draftRevision` inside `draftJson`), `startEdit(ownerId)` (active rows → `draftJson`, `draftKind = EDIT`), `countAffectedMeals(ownerId, draft)` (past linked meals whose slot/option would change — used for the confirm line), `confirmPlan(ownerId, draftRevision)` (one `$transaction`: every draft slot, option and item carries the **existing row id when it came from the active plan** (`startEdit` copies ids into `draftJson`; import and manual drafts have none) — rows with an id are updated in place, rows without an id are inserted, active rows whose id is absent from the draft are deleted; `position` is display order only. This keeps meal links pointing at the option the user actually chose even when options are removed or reordered (review finding 3; TS-§5 and decision 017 amended). `SetNull` cascades still turn a removed slot into "Other" and a removed option into "Needs review"; delete `DaySkippedSlot` rows of removed slots; targets/rules/notes replaced; copy `draftSourceText` to `sourceText` for import drafts; set `status = ACTIVE`, `confirmedAt`, clear `draftJson`/`draftId`; seed `Profile.weekStart` from the first listed weekday if still unset, else Saturday = 6), `discardDraft`, `deletePlan` (typed confirmation; rows deleted, `status = NONE`).
- Baseline (PLN-5) lives in the draft, never after confirm (PS-§6 "Plan confirmation includes review of its estimated baseline"; review finding 7; TS-§5.1 amended): the import job writes item nutrition and `ESTIMATED` daily targets into `draftJson`; for manual and edit drafts, `estimateDraftBaselineAction` runs `estimatePlanBaseline` for items with missing or changed nutrition when the user moves from the meals step to 8b, storing the result in `draftJson`; 8b shows it editable; confirm applies the draft atomically with no AI call. Daily `ESTIMATED` targets are the sum over the first option per slot; `SUM_OF_MEALS` is the arithmetic sum of the plan's **explicit per-meal ranges** and is created only when every slot has one and no daily figure was given — it never wraps estimates.
- Tests: `plan.service.test.ts` with `prismaMock`: confirm keeps ids on edit and replaces on import (TS-§21.2 restated by id), option removed → link `planOptionId` null, option reordered → link unchanged, affected-meals count (TS-§21.1), draft revision conflict, stale `draftId` finalize affects zero rows, over-limit text → `PLAN_TEXT_TOO_LONG`, delete sets `NONE`. Integration (1.6): the same three edit cases against Postgres.

**4.3 Plan actions** — `Plan: server actions per tech-spec §7`

- `src/actions/plan.actions.ts`: every row of TS-§7 "Plan" table; `startPlanImportAction` calls `after(runJobsNow)`; `getPlanImportStatusAction` is a read action for the 3 s poll; `confirmPlanAction` returns `{ affectedMeals }`. All revalidate `/plan` and `/today`.
- Tests: `plan.actions.test.ts` (auth, parse, service call, revalidate) following `user.actions.test.ts`.

**4.4 Onboarding plan screens and review UI** — split into `4.4a Plan: manual setup, review 8a–8c, ready (no AI)` and `4.4b Plan: add-your-plan import screen, preparing, import banner (needs 5.3, 5.5)`. 4.4a is built first so a complete usable path (sign-up → manual plan → planned-meal logging → Today) exists before any provider call.

- `src/app/(app)/onboarding/` screens 7, 7b, 8a, 8b, 8c, 9 per DS-2, and the same review component reused by My plan (edit/replace). Put the review in `src/components/product/plan-review/` (`SlotReview.tsx`, `TargetsReview.tsx`, `RulesReview.tsx`, `WeekdaySummary.tsx`) with callbacks; the page-level island `plan-review-flow.tsx` calls the actions.
- Screen 7: textarea `dir="auto"`, live character count near 20,000 (over-limit keeps the text and says "paste it in parts"), the Persian example including one meal with options, "I'll set it up manually", "I don't have a plan yet" (→ `onboardingStep = DONE`, Today shows "Add your plan"). First import: `AiNoticeSheet` (PS-§15 wording) → `acknowledgeAiNoticeAction('PLAN')` before `startPlanImportAction`.
- Screen 7b: poll `getPlanImportStatusAction` every 3 s; after 15 s show "This is taking a while…" with "Continue to Today"; Today's `ImportStatusBanner` shows pending/ready/failed (PS-§9 states, PS-§12 copy).
- 8a: one slot per screen; source excerpt beside the slot; `NameLabel` for names; "Assumed" tags; at most one question per screen and only for calorie-significant unknowns (`CALORIE_SIGNIFICANT`); weekday plans review one day then a summary "Apply the same checks to these days?". 8b: targets with source labels (explicit / "Estimated from your plan" / "Sum of your meal ranges"). 8c: each rule with Track it / Keep as a note / Don't compare; conflicts at the rule; "Not automatically tracked" list; "You can change any of this later in My plan"; **Confirm plan** shows "Past days will be compared against the updated plan · N meals affected" when N > 0 (edit/replace) — on first import N is 0 and the line is omitted.
- Manual setup: structure choice → name → (weekday: pick day, repeat) slots → items → options → times → per-meal ranges → daily targets → rules → source note → 8a–8c. Targets-only: name → targets → 8b → 8c. Each screen writes one `updatePlanDraftAction(section)`.
- Screen 9 "Ready": today's slots, one line about the daily reflection, "Log your first meal" (opens composer once phase 6 lands; until then goes to Today) and "Go to Today"; sets `onboardingStep = DONE`.
- e2e `e2e/plan-import.spec.ts` against the stub AI server (phase 5.5): J1 through Confirm; J12 (slow import → banner → Review now; failed → Try again / Set up manually keeps the text); manual targets-only plan confirms with no slot (PS-§17).

**4.5 My plan page** — `Plan: My plan page with edit, replace, delete`

- `src/app/(app)/(shell)/plan/page.tsx` + islands per DS-6: name, source note, confirmed on, goal (from Settings, PS-§5), today's slots or weekday `Tabs`, per-slot options/items/ranges via `PlanSlotRow` in read mode, daily targets with source labels, rules with tracking and current-period progress (`ruleObservation`, phase 7), Not automatically tracked, Source text in a `Disclosure`. Actions: Edit → `startPlanEditAction` → review flow; Replace → screen 7 flow with `draftKind = IMPORT|MANUAL`; Delete plan → `AlertDialog` naming the plan. Draft-pending state shows the same `ImportStatusBanner`.
- PRD: routes `/plan`, `/onboarding` move to built; note the draft/confirm behaviour.

### Phase 5 — AI integration (DeepSeek adapter, prompts, schemas, caps) — P1

Depends on 1.1, 1.5. Framework-free, Prisma-free adapter (decision 012).

**5.1 Adapter** — `AI: DeepSeek adapter with deadline, retry rule, zod validation`

- `src/services/ai/deepseek.ts`: `complete({ kind, system, user, images?, schema, deadline, maxTokens, userTag })` per TS-§10.1: OpenAI-compatible POST to `https://api.deepseek.com/chat/completions`, `response_format: { type: 'json_object' }`, `stream: false`, `user_id: userTag`, model by kind from env, thinking disabled with `thinking: { type: 'disabled' }` (TS-§10.1; runbook step 2 verifies), `AbortSignal.timeout(remaining)`, one retry on network/5xx when ≥ 40% of the deadline remains, empty content → `INVALID_JSON`, 429 → `RATE_LIMITED`, zod failure → `SCHEMA_REJECTED`; returns `{ ok, data, usage, model, durationMs }` or `{ ok: false, reason }`. Images base64-inline in the user message.
- `src/services/ai/record.ts`: `recordAiCall(prisma, …)` helper used by calling services (not by the adapter) to write one `AiCall` row per attempt; `admitOperation(ownerId, kind, localDate)` implementing TS-§10.4 atomically (review finding 10): caps count **user operations** (one meal analysis, one plan import, one reflection update), not provider attempts; admission inserts an `AiCall` row with `outcome = PENDING` inside a transaction that first counts that day's rows of the same kind for the user (`SELECT … FOR UPDATE` on the user row serialises concurrent admissions); the row is updated with the final outcome, tokens and duration when the operation ends, and per-attempt metadata (`attempts[]`, returned by the adapter for every attempt) is written to `AiCall.attemptsJson`. The global token budget is a soft cap on completed tokens plus `PENDING` rows × a reserve of 8k tokens; at 90% new operations get `AI_UNAVAILABLE`. `PENDING` is added to the `AiOutcome` enum in 1.2.
- Tests: `src/__tests__/services/ai/deepseek.test.ts` with mocked `fetch`: valid, invalid JSON, empty content, schema rejection, timeout, 429, retry budget respected, late response discarded (TS-§15).

**5.2 Prompts and schemas** — `AI: prompts and output schemas for import, meal, reflection`

- `src/services/ai/prompts/plan-import.ts`, `meal-text.ts`, `meal-photo.ts`, `reflection.ts`, `plan-baseline.ts`: versioned constants (`PROMPT_VERSION`), fixed system prompt declaring user content as data, one JSON example each (DeepSeek JSON-mode requirement), unit table injected as text so the model resolves household units through PS-§6 rather than guessing; English-only prose; food names verbatim + English label; digits normalized in the parsing copy (`lib/text`). Reflection prompt receives the fact list with ids and must return `{ paragraph, usedFactIds }` (40–110 words, TS-§10.2).
- `src/services/ai/schemas.ts`: zod schemas for each output (reuse `nutritionSchema` from 1.5; quantities non-negative; units from the unit table keys or `null`; categories from the enum; `sourceExcerpt` strings). Post-validation checks live in the calling service: every `sourceExcerpt` must be a substring of `sourceText` else replaced by `''` (TS-§8); every `usedFactId` must exist (TS-§10.2).
- `src/services/ai/interpret-plan.ts`: `interpretPlan(sourceText, profileContext, deadline)` — for `BY_WEEKDAY` text, chunk per weekday (detect headings after normalization; fall back to one call) and divide the remaining budget by remaining chunks (TS-§10.2). `estimatePlanBaseline(items)`; `analyzeMeal(input)`; `generateReflection(facts)`. Each returns validated data + `AiCall` metadata; the caller persists.
- Profile fields go to import and reflection only, never to meal analysis (PS-§5, TS-§10.2).
- Tests: schema tests with recorded good/bad payloads; excerpt substring check; chunking of the weekday fixture text.

**5.0 Real-provider smoke** — `AI: real DeepSeek smoke on both plans and five meals` (P1, needs `DEEPSEEK_API_KEY` locally; the two reference plans and five Persian meal descriptions through 5.2's functions; records schema pass, latency and any prompt fixes in the runbook before UI work depends on the adapter — review "AI evaluation").

**5.3 Wire into plan import** — `AI: run plan import job through the adapter and write draftJson`

- `plan-import.job.ts` calls `interpretPlan` then `estimatePlanBaseline` per chunk within the 120 s budget; writes `AiCall` rows; `errorCategory` on failure. `confirmPlan` calls `estimatePlanBaseline` for changed items (4.2).
- e2e uses the stub server (5.5).

**5.4 USDA lookup (flagged)** — `AI: USDA secondary lookup with FoodDataCache`

- `src/services/food-data/usda.ts` per TS-§10.6, behind `USDA_LOOKUP_ENABLED`; used by meal analysis post-processing for generic items only; results cached 30 days in `FoodDataCache`; provenance `sourceRef: 'usda:<fdcId>@<version>'`. P3 — can ship disabled.

**5.5 Stub AI server for e2e** — `AI: deterministic stub DeepSeek server for Playwright`

- `e2e/stub-ai/server.mjs` (plain `http`, no dependency): returns canned JSON per `kind` inferred from the system prompt marker; scenarios selected by a header or by the user text (`SLOW`, `FAIL`, `EMPTY`). `e2e/playwright.config.ts` starts it as a second `webServer` and sets `DEEPSEEK_API_BASE_URL` (in `env.ts` since 1.1, default `https://api.deepseek.com`) for the dev server. `SCHEDULER_ENABLED=true` in e2e for the import job (TS-§14 v1.2.1, O10).

### Phase 6 — Meals (drafts, analysis, review, save, edit, links) — P1

Depends on 1.2, 1.4, 1.5, 3.4, 4.2 (slots), 5.1–5.2. Photo input is stubbed until phase 9 and
hidden behind `PHOTO_LOGGING_ENABLED`.

**6.1 Meal draft service** — `Meal: server-held drafts with clientRequestId and revisions`

- `src/lib/validations/meal.ts`: `createMealDraftSchema` (clientRequestId uuid, kind, text ≤ 2,000 chars, uploadIds ≤ 3, date ISO, time `HH:mm` or null, slotId?, optionId?), `updateMealDraftSchema` (edits: items add/remove/change quantity/unit/prep/identity/label values, answers, date/time/slot/option/notes), `saveMealSchema`, `updateMealSchema`, `setMealLinkSchema`, `markSlotSkippedSchema`, `setDayCompletenessSchema`.
- `src/services/meal.service.ts` draft half: `createDraft` (idempotent on `clientRequestId`: returns the existing draft or the existing meal if already saved — TS-§21.9), `getDraft`, `updateDraft(ownerId, draftId, expectedRevision, edits)` (revision +1; input-field edits recompute `analysisInputHash`; item edits rescale through `scaleNutrition`), `analyzeDraft(ownerId, draftId, expectedRevision)` (admission → `analysisStatus = RUNNING`, `analysisRunId = cuid()`, `analysisStartedRevision = revision` → `analyzeMeal` with the 45 s deadline → persist with a conditional update `WHERE id = $draft AND "analysisRunId" = $run AND revision = $startedRevision`; zero rows affected means the user edited or re-analysed meanwhile → the result is dropped and the draft is left as the user has it, `analysisStatus = FAILED` reason `SUPERSEDED` only if no newer run is in flight — TS-§21.8; review finding 11; restriction hits computed with `restrictionHits`; suggested slot/option from the AI mapped to real ids by name overlap), `expireDrafts` (used by the cleanup task).
- Tests: `meal.service.test.ts` (idempotent create; superseded analysis discarded; revision conflict → `CONFLICT`; rescale on quantity edit; `userOverride` never scales).

**6.2 Save, update, delete, link, reuse** — `Meal: save with idempotency, revisions, links, skipped slots, completeness`

- `meal.service.ts` confirmed half: `saveMeal(ownerId, draftId, expectedRevision, clientRequestId)` — the action always sends the stable `clientRequestId` too (TS-§7 amended; review finding 4), so a retry whose first response was lost finds the meal by `clientRequestId` after the draft is gone and returns it. Refuses `OPTION_REQUIRED` when the slot has >1 option and none chosen; `FUTURE_TIME` when the date is after today in the day's zone, or when date+time is after `now` (a future date with unknown time is still future); saving into a slot the day had marked skipped deletes the `DaySkippedSlot` row (recorded wins; same rule in `updateMeal` and `setMealLink`); one `$transaction`: upsert `DayRecord` (zone = profile zone at creation), insert `Meal` + `FoodItem`s via `createMany`, mark uploads `ATTACHED`, delete the draft; repeat with the same `clientRequestId` returns the existing meal), `updateMeal` / `deleteMeal` (`expectedRevision` → `CONFLICT` with the current row), `setMealLink` (validates option ∈ slot and slot weekday = day weekday), `reuseMeal` (copies values into a new draft, `copiedFromMealId`, never modifies the source), `listRecentMeals(ownerId, limit)` (composer row; 60 s in-process cache per TS-§17), `getMeal(ownerId, id)`.
- `src/services/day.service.ts` write half: `markSlotSkipped(ownerId, localDate, slotId, skipped)` (`SLOT_HAS_MEAL` guard; creates the `DayRecord` lazily), `setDayCompleteness(ownerId, localDate, complete)` (never reset by meal saves — PS-§8).
- `src/actions/meal.actions.ts`: every row of TS-§7 "Meal" table. Revalidate `/today`, `/history`, `/meals/[id]`.
- Tests: service (double save → one meal; save committed but response lost, retry with the same `clientRequestId` → same meal; stale revision; option required; future date with null time; save into a skipped slot unskips it; skip guard), actions. Integration (1.6): two concurrent saves with one `clientRequestId`.

**6.3 Meal composer** — `Meal: composer sheet (text, recent, planned, manual, more details)`

- `components/product/MealComposer.tsx` (props + callbacks) rendered by `src/app/(app)/(shell)/meal-composer.tsx` island mounted from the shell's `LogMealButton`; opens as `Sheet side="bottom"` on mobile (full-height on small screens), `Dialog` on `md+`. Content per DS-4 "Compose": text field `dir="auto"`, photo button only when `PHOTO_LOGGING_ENABLED` (pass the flag from the server layout as a prop; the server also refuses with `PHOTO_DISABLED`), Recent meals row, Today's planned slots row (multi-option slot expands its options with "Last time" on the last-used option — derive from the latest meal linked to that slot — nothing preselected), date/time summary near Save, "Logging for [date]" banner when the composer opened from a History day (pass `initialDate`), late-night prompt "Was this for yesterday?" when `isLateNightWindow(now, zone)` (client uses the profile zone passed as a prop), "More details" `Disclosure` with date, time (`"I don't remember the time"` → `time = null`), slot picker (plan slots for that weekday + "Other · in addition to your plan"), notes. First text analysis: `AiNoticeSheet` (`MEAL_TEXT`) → `acknowledgeAiNoticeAction`.
- Draft lifecycle on the client (review finding 11): generate `clientRequestId` when the sheet opens; everything typed before the first server call (text, chosen slot/option, date/time) is mirrored to `sessionStorage` under `composer:<userId>:<clientRequestId>` on every change; `createMealDraftAction` on first Analyze/Continue; review edits are autosaved with a 500 ms debounce through `updateMealDraftAction`, and the sheet shows an "Unsaved" indicator while an autosave is pending or failed and "Offline — your edits are kept here" when `navigator.onLine` is false; on reopen the composer restores from `sessionStorage` first, then from the server draft if one exists; the storage key is per user id so another account never reads it, and the logout button clears `composer:*` before submitting `logoutAction` (PS-§15).
- Analyzing state: after 15 s show the calm status + "Enter manually"; at 45 s the action returns `AI_TIMEOUT` and the draft stays (PS-§7, TS-§10.2). Failure keeps input and shows Retry / manual (PS-§12 copy).
- Messages: all DS-4 / PS-§12 rows for the composer.

**6.4 Check your meal (review) and save** — manual, recent and planned paths only; the text-analysis path is 6.6 so this task does not depend on phase 5 — `Meal: review screen with items, totals, questions, restriction line`

- `components/product/MealReview.tsx`: items (`NameLabel`, quantity, unit `Select` from the unit table, prep), "Estimated"/"Assumed" tags, grouped questions (PS-§7 "How much of this dish did you eat?"), restriction reminder line (PS-§12 wording; never blocks), "Added: …" chip for items beyond the chosen option (`updateDraft` runs `matchSlot` on the server and returns `preview: { match }` so the review shows the same result Today will), totals energy/protein/carb/fat with "Some values are unknown" notice when any is `null` (save still allowed), Sources `Disclosure`, unsaved indicator, Save meal disabled until an option is chosen for a multi-option slot. Edits call `updateMealDraftAction` with the revision; identity/prep changes mark the item `needsReestimate` with previous values struck through until confirmed (TS-§5.1).
- Save: `saveMealAction` → toast "Meal saved" only on `ok`; on `CONFLICT` show "This meal was updated on another device" + Reload keeping edits (PS-§12); on failure keep content ("Your meal hasn't saved yet…").
- Analytics: `meal_save_succeeded`, `analysis_failed` via `src/services/analytics.service.ts` (`recordEvent(name, props)` with an allow-list of PS-§16 names; called from actions, never with content).
- e2e `e2e/meal-logging.spec.ts` (both projects, stub AI): J2 planned meal with options (cannot save without an option; "Last time" not preselected), J3 text meal reaching review then saved and listed, J4 Other, J5 replaced meal under Lunch → "Different food" (needs phase 7 Today), J11 late-night prompt with `page.clock`, double-click Save creates one meal, restriction reminder appears when Settings restriction matches (needs phase 10 — mark as `test.fixme` until then).

**6.6 AI analysis in the composer** — `Meal: text analysis path with notice, 15 s status, 45 s timeout` (depends on 5.0, 5.2, 5.5, 6.4): Analyze → `AiNoticeSheet('MEAL_TEXT')` once → `analyzeMealDraftAction` → review prefilled; the 15 s / 45 s states and `analysis_failed` analytics from 6.3 apply here.

**6.5 Meal details page** — `Meal: /meals/[id] details with edit, link, delete, reuse`

- `src/app/(app)/(shell)/meals/[id]/page.tsx` + island per DS-5: time or "time unknown", slot or Other, link + option + match status with reason (from `computeDayView` for that day, phase 7 read model), items, nutrition (4 + more), sources, photos (phase 9), notes, differences. Actions: Edit (`MealReview` in "edit" mode calling `updateMealAction` with `expectedRevision`; §3.4), Change plan link (slot + option picker → `setMealLinkAction`), Remove photo (phase 9), Delete (`AlertDialog` "Delete this meal? Your daily totals will update."), Reuse as new meal (→ composer with the new draft).
- e2e: J7 edit and delete update the day (assert on Today after phase 7).

### Phase 7 — Today and History (comparison on read) — P1

Depends on 1.3, 1.4, 4.2, 6.2, 2.3.

**7.1 Day read model** — `Day: computeDayView service over meals, skips, plan, now`

- `src/services/day.service.ts` read half: `getDayView(ownerId, localDate, now)` — the TS-§17 three parallel queries (day with meals+items, skipped slots + plan slots for that weekday, message) → convert Decimals to numbers → `computeDayView` (1.4) → `DayView` carrying `rubricVersion`, coverage, contributing `{mealId, revision}[]`, per-slot components, nutrition results, rule observations. `getSevenDayView(ownerId, endDate, now)` — one range query for days+meals+items + plan slots → `sevenDaySummary`. Weekly rules (review finding 13): when the plan has a `TRACK` rule with `period = WEEK`, `getDayView` also loads the anchored week containing the date (`weekStart` from the profile; `weekBounds(localDate, weekStart)` in `lib/time`) — days, meals and items in one range query — and passes `daysInPeriod` (each day's items, `logComplete`, and whether every slot is recorded or skipped) to `ruleObservation`. Rule `definition` JSON per kind, validated by zod in `lib/validations/plan.ts`: `SERVING_COUNT` `{ food: { originalName, englishLabel, synonyms[] }, count, comparator: 'AT_LEAST' | 'AT_MOST' | 'EXACT' }` — one serving per recorded meal containing a matching item; `DISTINCT_GROUPS` `{ groups: string[], minimum }` — membership from `FoodItem.category` plus user-confirmed `FoodItem.ruleGroups String[]` (asked in review only when an item's category maps to no group), each group counted once; `NAMED_WEEKDAY_FOOD` `{ weekday, food }` — observation only, the food component already scores it; `EXCLUSION` `{ foods: [...] }` — flagged when a recorded item matches; `TIMING_WINDOW` `{ slotId, start, end }` — feeds `timeResult`; `INSTRUCTION` — note only. Food-name matching is one function, `lib/rubric/names.ts` `sameFood(a, b)`: `normalizeInput` both sides, then equal English labels (case-insensitive) or equal original names or a synonym hit; a related food is never equal (PS-§8). Add `FoodItem.ruleGroups String[] @default([])` in 1.2. Historical days use `DayRecord.timeZone`; a date with no row is computed as empty in the profile zone. `dayPhase` from `now` (TS-§21.5).
- `src/actions/day.actions.ts`: `getDayAction`, `getSevenDayAction` (reads, for client refresh after mutations), `markSlotSkippedAction`, `setDayCompletenessAction`.
- Tests: `day.service.test.ts` with factories: two sittings → one slot score, coverage "1 of 5" (TS-§21.3); different options → `NEEDS_REVIEW` (TS-§21.4); midnight flip (TS-§21.5); complete-by-default label and trend exclusion (PS-§8 acceptance).

**7.2 Today page** — `Today: header, banner, reflection slot, plan block, meals, completeness`

- `src/app/(app)/(shell)/today/page.tsx` (server: `requireOnboarded`, `getProfile`, `getPlan`, `getDayView(today in profile zone)`, `getMorningMessage` placeholder until phase 8) + islands. Blocks per DS-3 in order: header (date via `formatDate` with the profile zone passed explicitly — never `locale.timeZone`; greeting via `greetingNameFor`), `ImportStatusBanner` (only while a draft is pending/ready/failed), `ReflectionCard` (phase 8; renders nothing until then), **Your plan today** = `ScoreCard` ("In progress" on today; wording band + coverage; number only with ≥2 scored; "Not enough information yet"; `WhyThisScore` disclosure listing components per slot) + `PlanSlotRow` per slot in plan order (`NameLabel`, one status label — Not recorded / Marked skipped / Needs review → "Choose the option you ate" / Matched / Partly matched + reason / Different food, option count or picked option, energy range, expand for `DifferenceChip`s, Mark skipped, Log this meal on the next unrecorded slot, Log another meal when all recorded/skipped) + `NutritionDetails` disclosure (recorded vs target, source label, missing-value notes), **Recorded meals** chronological rows (time or "time unknown", name, slot/Other → `/meals/[id]`), `CompletenessCheckbox` with helper copy (past day with gaps: "2 of 5 meals recorded. Mark the rest skipped if you didn't eat them.").
- States (PS-§9, DS-3): no plan → "Add your plan" link to `/plan`, logging still available; no records → "Log your first meal"; targets-only plan → nutrition only, no score, one-line explanation; device time zone changed → compare `Intl…resolvedOptions().timeZone` with `Profile.timeZone` client-side, one dismissible line → `reportDeviceTimeZoneAction` / `dismissTimeZoneHintAction` (`Profile.lastSeenDeviceTimeZone`); `loading.tsx` with layout-stable skeletons (no zero totals); `error.tsx` with retry.
- Viewport acceptance: on 390×844 Log meal is visible without scrolling (e2e assertion with `page.setViewportSize`).
- e2e `e2e/today.spec.ts`: J2/J5 assertions, Mark skipped changes coverage not score, completeness toggle persists across reload, no-plan state.

**7.3 History** — `History: seven-day view, day rows, date picker, day page`

- `src/app/(app)/(shell)/history/page.tsx` (seven days ending today) and `history/[date]/page.tsx` (validate `YYYY-MM-DD`; future dates 404). Seven-day: one-sentence summary from `sevenDaySummary` with denominators and the PS-§10 priority order, "A few more complete days will make patterns clearer." under three comparable days, plan-changed label when `Plan.confirmedAt` falls inside the window (PS-§10; decision 017 means no version — the label is the only trace); day rows with score / band / "Incomplete log" / "No meals recorded" / "complete by default, 2 of 5 meals"; explicit variety rules in a `Disclosure`; `DatePicker` for older days. Day page reuses the Today blocks for that date with "Logging for [date]" composer context (J6) and the reflection that referenced it (phase 8).
- e2e `e2e/history.spec.ts`: J6 backdate with unknown time; J9 finish a past day → counts in patterns.

**7.4 Rule observations on My plan and History** — `Day: rule observations for tracked rules`

- Wire `ruleObservation` results into `/plan` (current period progress) and History day/seven-day (final status only when the period ended with complete data; plan change mid-period → progress against the updated plan, labelled, no pass/fail — PS-§8).

### Phase 8 — Reflection (morning message) — P1

Depends on 5.1–5.2, 7.1.

**8.1 Reflection service and claim protocol** — `Reflection: claim protocol, fallback library, staleness`

- `src/services/reflection.service.ts`: `getOrCreateMessage(ownerId, localDate, now)` implementing TS-§10.3 exactly: `INSERT … ON CONFLICT DO NOTHING RETURNING id` via `$queryRaw` (pooler-safe), facts from `reflectionFacts(yesterdayView, plan, profile, todayView)` (today's confirmed meals only to avoid a wrong next step; time-of-day greeting from `now` in the zone — PS-§11), `factsHash`; owner path calls `generateReflection` with the 15 s deadline, validates `usedFactIds`, writes `READY` with paragraph or fallback under the conditional update; reader path returns `READY`, or `GENERATING` (≤ 20 s), or takes over with the fallback (> 20 s; a later provider response cannot overwrite — TS-§21.12). `updateMessage` (regenerate in place; counts toward the 3/day cap), `setCollapsed`, `markStaleIfNeeded(ownerId, affectedDate)` called from every meal/plan/completeness mutation with the date it touched: the candidates are the message of `affectedDate + 1` (its retrospective) and today's message (its "today" facts) — a week-old edit therefore re-checks the message generated the following morning (review finding 12); recompute facts, `isReflectionStale(snapshot, current, usedFactIds)` → `stale = true` only when a used fact changed band/status (TS-§21.13). Output checks beyond `usedFactIds` (PS-§13 unsupported-fact rate): every number in the paragraph must appear in a used fact's text, and the paragraph must contain none of a small banned list (`cheat`, `exercise`, `training`, `workout`, `fasting`, `good food`, `bad food`); a failure is `SCHEMA_REJECTED` and the fallback is used.
- `src/services/reflection/fallbacks.ts`: deterministic English paragraphs for the six PS-§11 states (complete, unchecked, no records, first day, no plan, provider failure), built from facts with `t()` keys so wording is reviewable; never claims the user confirmed completeness; never mentions training/exercise/fasting.
- `src/actions/reflection.actions.ts`: `getMorningMessageAction` (client polls every 2 s for up to 25 s while `GENERATING`, past the 20 s takeover point so a dead owner is always recovered by one of the polls; after 25 s the card shows "Still preparing your reflection" with a Retry that calls the action again — TS-§7 amended), `updateReflectionAction`, `setReflectionCollapsedAction`.
- Tests: service with `prismaMock` for owner/reader/takeover paths; fallback state selection; staleness cases (Matched → Different food stale; note edit not stale). Integration (phase 11): single flight with 20 concurrent calls (TS-§21.11).

**8.2 Reflection card on Today and History** — `Reflection: ReflectionCard with collapse, stale badge, update`

- `components/product/ReflectionCard.tsx`: title "Today's reflection", paragraph with `NameLabel`-style bidi for quoted food names, Collapse (persisted per date via `setReflectionCollapsedAction`), "based on an earlier log" badge + Update reflection when `stale`. the request is made by a small island in the **shell layout**, not by Today, so the first authenticated visit of the local day on any product page triggers generation (PS-§11 deep-link rule; review finding 12): on mount and on `visibilitychange`, it computes the local date in the profile zone, and if `sessionStorage['reflection-requested']` differs, calls `getMorningMessageAction` and remembers the date — so returning after midnight requests the new day's message; it never blocks the page and never interrupts the composer. History day shows the message whose facts referenced that date (the next day's message) read-only.
- e2e `e2e/reflection.spec.ts`: first visit shows a paragraph (stub returns fixed text); refresh returns the same; stub `FAIL` → fallback text; editing yesterday's meal match status shows the stale badge; Update replaces it.

### Phase 9 — Photos (flagged) — P2

Depends on 6.1, 6.3, 4.1 (cleanup task). Ships behind `PHOTO_LOGGING_ENABLED=false` (O3).

**9.1 Storage adapter** — `Storage: S3 adapter with two targets`

- Install `@aws-sdk/client-s3`. `src/services/storage/s3.ts`: `createStorage(target: 'photos' | 'backup')` from `S3_*` / `BACKUP_S3_*` env (`forcePathStyle: true` for Supabase), `putObject`, `getObjectStream`, `deleteObject`, `listKeys(prefix)`, `headObject`. Keys `{S3_KEY_PREFIX}uploads/{userId}/{uploadId}.jpg`. Usage gauge = `SUM(Upload.bytes) WHERE status != REMOVED` → `STORAGE_FULL` above `STORAGE_SOFT_LIMIT_BYTES`.
- Tests: unit with a mocked client.

**9.2 Upload and photo routes** — `Photos: POST /api/uploads, DELETE /api/uploads/[id], GET /api/photos/[id]`

- Install `sharp`. `src/app/api/uploads/route.ts` (POST): `requireAuth`, `Origin === APP_URL` check, `PHOTO_LOGGING_ENABLED` else `403 PHOTO_DISABLED`, rate limit 60/user/hour, multipart `file`, magic-byte sniff (JPEG/PNG/WebP; HEIC → 415), 10 MB, decode semaphore of 2, `sharp({ limitInputPixels: 40e6 }).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 })` (metadata stripped by default), `Upload` row `STAGED` with `expiresAt = now + 24 h`, `sha256`, returns `{ uploadId, width, height }`. `DELETE /api/uploads/[id]`: staged only, owner. `GET /api/photos/[id]?s=<tag>`: owner check, `tag === sha256(sessionToken).slice(0, 12)` (the raw cookie token is available in the handler via `cookies()`), streams with `Cache-Control: private, max-age=86400`; 404 for another account (TS-§21.16). Add `sharp` to `serverExternalPackages` in `next.config.ts`.
- `src/services/upload.service.ts`: the DB side (`stage`, `attach`, `remove`, `expire`), used by routes, `saveMeal` (attach), `removeMealPhotoAction`, cleanup task.
- Tests: route unit tests with `Request` objects (magic bytes, size, HEIC 415, origin check); e2e upload with a fixture JPEG when the flag is on (`PHOTO_LOGGING_ENABLED=true` in the e2e env).

**9.3 Device pipeline and composer integration** — `Photos: device conversion and the photo path in the composer`

- Install `heic-to` (browser only, dynamic import). `src/components/product/photo-input.ts`: accept JPEG/PNG/WebP/HEIC/HEIF, convert HEIC with `heic-to`, canvas downscale to 2048 px max edge at JPEG 0.85, upload via `fetch('/api/uploads')`, preview + remove (calls DELETE while staged), 1–3 photos; camera denial still leaves upload/text/recent/manual (PS-§7). First photo analysis: `AiNoticeSheet('MEAL_PHOTO')`. Composer passes `uploadIds` to the draft; `analyzeDraft` reads the staged objects and sends base64 inline (nothing uploaded to the provider). Meal details shows photos through `/api/photos/[id]?s=`; Remove photo keeps the food record.
- Manual test on a real iPhone (HEIC) recorded in the task report; automated e2e covers the JPEG path.

**9.4 Cleanup task** — `Jobs: hourly cleanup of staged uploads and expired drafts`

- `src/services/jobs/cleanup.job.ts`: `STAGED` past `expiresAt` (object first, then row) and `MealDraft` past `expiresAt` with their uploads (TS-§21.18). Registered in the scheduler (4.1).

### Phase 10 — Settings, export, account deletion — P2

Depends on 2.x, 3.3, 7.1.

**10.1 Settings page** — `Settings: profile, preferences, account, privacy sections`

- `src/app/(app)/(shell)/settings/page.tsx` + islands per DS-8. Profile: age, sex, height, weight + `weightMeasuredAt` (`DatePicker`), display name, goal (shown on My plan only, never sent to AI), restrictions (free text list; stored as `restrictionsOriginal` + normalized `restrictions`) → `updateProfileAction`. Preferences: units, time zone (`Select`), week start (0–6, weekday names via `Intl`), appearance (3.3) → `updatePreferencesAction`. Account: username, "A forgotten password can't be recovered in this release.", Change password (`AlertDialog` form → `changePasswordAction`, signs out other devices), Log out (`logoutAction`). Privacy & data: the three AI-notice wordings, Export (link to `/api/export`), Delete account (typed username → `requestAccountDeletionAction`). Admin-only "Tools" list (Users, Components).
- Tests: `profile.service.test.ts` additions (weight date, restrictions normalization), actions; e2e `e2e/settings.spec.ts`: change password logs out a second context; restriction reminder now un-fixmes the phase 6 e2e; appearance choice survives reload.

**10.2 Export** — `Export: GET /api/export streaming zip`

- Install `archiver`. `src/app/api/export/route.ts`: `requireAuth`, `src/services/export.service.ts` builds `profile.json`, `plan.json`, `meals.json` (with food items and links), `messages.json`, `photos/{uploadId}.jpg` streamed from storage; filename `dietyaar-export-{date}.zip`; `Content-Type: application/zip`. No secrets, no `passwordHash`.
- Tests: service unit test on the JSON shapes; e2e downloads the zip and checks entries.

**10.3 Account deletion and purge** — `Account: request deletion, refuse login, hourly purge`

- `account.service.ts`: `requestDeletion(ownerId, typedUsername)` sets `deletionRequestedAt`, `deletionScheduledFor = +7 d`, `isActive = false`, revokes all sessions, cancels `QUEUED|RUNNING` import jobs (PS-§15 "disables access and pending AI jobs"). `findUserBySessionToken` already refuses inactive users. `src/services/jobs/purge.job.ts`: hourly, users past `deletionScheduledFor` → delete storage objects under the user prefix, then the `User` row (cascades). The purge also deletes the user's `photos/{key}` objects from the backup bucket; dumps are encrypted and expire by age (11.3), which together with this is the PS-§15 "backups expire within 30 days" commitment (review finding 16).
- Tests: service; integration later. e2e J14: delete → login refused.

### Phase 11 — Ops, CI, deployment, hardening — P2/P3

**11.1 Liveness, CSP, Origin checks** — `Ops: /api/live, CSP header, Origin check helper` (P2)

- `src/app/api/live/route.ts` returns 200 with no dependencies. `next.config.ts`: add the TS-§8 CSP with `connect-src 'self'`; Sentry uses `tunnelRoute: '/monitoring'` (O9). `src/lib/request-origin.ts`: `assertSameOrigin(request)` used by mutating route handlers.

**11.2 Observability** — `Ops: Sentry with scrubber, Loki metrics fields, analytics SQL` (P3)

- Install `@sentry/nextjs`; `sentry.*.config.ts` with `tracesSampleRate 0.05` and `beforeSend` dropping bodies and the TS-§13 field names; `instrumentation.ts` `onRequestError` hook. Structured log fields for the TS-§16 metrics (AI outcome/duration by kind, upload bytes, storage usage, `pg_database_size()` daily line, save success/conflict, scheduler task duration, backup success, fallback rate). Weekly analytics SQL in `docs/runbook.md`.

**11.3 Backup task and script** — `Ops: nightly pg_dump + photo copy to Hamravesh; npm run db:backup` (P2)

- Install `postgresql-client` 17 in the image (O12). `src/services/jobs/backup.job.ts` per TS-§12 amended (review finding 16): copy new `ATTACHED` photo objects to `photos/{key}` **first**, then `pg_dump --format=custom` via `child_process` against `DIRECT_DATABASE_URL`, gzip, encrypt with `openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY` (key is a Darkube secret env; `openssl` is already in the image), upload `db/{date}.dump.gz.enc`; retention is by age — delete dumps older than `BACKUP_RETENTION_DAYS` (default 30) but always keep the newest one; `scripts/db-backup.mjs` is an operator script run from a developer machine (or the Darkube terminal, which has the image and its `pg_dump`) with the production env — it is not part of the standalone bundle, and the nightly path is the in-process task. Restore rehearsal (runbook step 5) decrypts with the same key and uses the production image. Prune task `src/services/jobs/prune.job.ts` (AiCall/AnalyticsEvent 90 d, FoodDataCache 30 d).
- Restore rehearsal = runbook step 5 (operator).

**11.4 Docker and CI** — `Ops: Dockerfile mirror + pg client; CI integration, mobile e2e, registry push, darkube deploy` (P2)

- `Dockerfile`: base `hub.hamdocker.ir/library/node:lts-slim` in every stage, `ENV TZ=UTC`, install `postgresql-client-<major>` from the PostgreSQL apt repo (major from the runbook), keep `sharp` prebuilt (no HEIC). Image tag = short SHA.
- `.github/workflows/ci.yml`: add `integration` job (Postgres service; `vitest --project integration` with `src/__tests__/integration/**` and a real `DATABASE_URL`; covers TS-§15 list: job claim concurrency, lease takeover, reflection claim, save idempotency, `CONFLICT`, superseded analysis, plan confirm remap, migration `lock_timeout`), extend `e2e` to run both Playwright projects with the stub AI server and `PHOTO_LOGGING_ENABLED=true`, the `docker` job gets `needs: [quality, integration, e2e]`, builds and smoke-tests the image, and only on `main` pushes `registry.hamdocker.ir/<org>/dietyaar:<sha>` and runs `darkube deploy …` with secrets `DARKUBE_DEPLOY_TOKEN`, `DARKUBE_APP_ID` (review finding 15). Rollback = `darkube deploy --image-tag <previous sha>` (documented in the runbook); it is safe because migrations are backward compatible with the previous release (TS-§13). Migration-safety step: diff `prisma/migrations` against the previous tag and fail on `DROP`/`ALTER … TYPE` without a `-- decision:` comment (a small `scripts/check-migrations.mjs`).
- `vitest.config.mts`: `projects` for `unit` and `integration` (integration excluded from `npm run test`; run with `npm run test:integration`).

**11.5 Accessibility and evaluation harness** — `Ops: axe checks; npm run ai:eval harness` (P3)

- Install `@axe-core/playwright`; `e2e/a11y.spec.ts` on Today, Log meal, Check your meal, Settings, both themes; zero serious/critical (TS-§15).
- `scripts/ai-eval.mjs` + `src/__tests__/fixtures/ai-eval/` (both plans, plus 40 Persian meal descriptions seeded from the plans' foods with `reviewed: false` until the owner reviews them — O11), reports the TS-§10.5 metrics; not in CI.

**11.6 Query budget review** — `Ops: review Today/save query counts against measured R` (P3)

- After runbook step 2: log query counts per page in dev, compare with TS-§17 (Today 3, save 1 txn, History 2). Until then the 150 ms default applies (O1).

## 6. Dependency graph and beads setup

```
0.1 ─ 0.2 ─────────────────────────────────────────────┐ (production only)
1.1 ─┬─ 1.2 ─┬─ 2.1 ─ 2.2 ─ 2.3                         │
     │       ├─ 3.1 ─ 3.2 ─ 3.3 ─ 3.4                    │
     │       ├─ 4.1 ─ 4.2 ─ 4.3 ─ 4.4 ─ 4.5              │
     │       ├─ 6.1 ─ 6.2 ─ 6.3 ─ 6.4 ─ 6.5              │
     │       └─ 7.1 ─ 7.2 ─ 7.3 ─ 7.4                    │
     ├─ 1.3 ─┐                                           │
     ├─ 1.4 ─┴─ (7.1)                                    │
     ├─ 1.5 ─── 5.1 ─ 5.2 ─┬─ 5.3 (→ 4.4)               │
     │                     ├─ 5.4                        │
     │                     ├─ 5.5 (→ 4.4 e2e, 6.4 e2e)  │
     │                     └─ 8.1 ─ 8.2                  │
     └─ (9.1 ─ 9.2 ─ 9.3 ─ 9.4)  (10.1 ─ 10.2 ─ 10.3)   │
11.1 · 11.2 · 11.3 · 11.4 · 11.5 · 11.6 ◄────────────────┘
```

Parallelisable once 1.2 is merged: {2.x}, {3.x}, {1.3, 1.4, 1.5}, {5.1, 5.2}. Phase 4 and 6 UI
work needs 3.4. Phase 7 needs 4.2, 6.2, 1.4. Phase 8 needs 7.1 and 5.2.

Execution order (task level, revised 2026-09-17 so a usable path exists before the AI work): 1.1 → 1.2 → 1.6 → {1.3, 1.4, 1.5} → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1 → 4.2 → 4.3 → **4.4a** (manual plan) → 6.1 → 6.2 → 6.3 → 6.4 (manual/recent/planned logging) → 7.1 → 7.2 (Today) → 5.1 → 5.2 → **5.0** (real-provider smoke) → 5.5 → 5.3 → 4.4b → 4.5 → 6.6 → 6.5 → 7.3 → 7.4 → 8.1 → 8.2 → 9.x → 10.x → 11.x. The beads graph encodes these edges.

Beads: create one `epic`-typed issue per phase (`bd create --type=epic --title="Phase N — …"`),
one `task` per numbered task with the title given above, `bd dep add <task> <prerequisite>` per
the graph, and `bd dep add <task> <epic>` is not needed (use the epic as a parent only if the
installed `bd` supports `--parent`; otherwise prefix task titles with `P1.2` style tags). Priority
0 for tasks on the 1.x → 4.x → 6.x → 7.x → 8.x spine, 2 for the rest, 3 for 11.2/11.5/11.6.

## 7. Cross-cutting conventions for this project

These extend `AGENTS.md`; they are decisions this plan makes so tasks do not each re-decide them.

- **Where product pages live.** `src/app/(app)/(shell)/<route>/` for anything with the tab shell; `src/app/(app)/onboarding/` without it; `src/app/(app)/admin/` unchanged. `(app)/layout.tsx` only authenticates.
- **Time.** Services pass `now: Date` and `zone: string` into `lib/time` and `lib/rubric`; pages compute "today" as `localDateFor(new Date(), profile.timeZone)`. Display through `@/lib/format` with `{ timeZone: profile.timeZone }` passed explicitly. `locale.timeZone` is never read (lint rule 1.1).
- **Decimals.** Prisma `Decimal` → `number` in the service at the read boundary (`toNumber()`), `number` → `Decimal` string at write. Rubric and scaling operate on numbers rounded to three decimals.
- **Revisions.** `Meal.revision` and `MealDraft.revision` increment on every write; actions take `expectedRevision`; services throw `ServiceError(t('errors.conflict'), 'CONFLICT', { current })`. Extend `ServiceError` with an optional `details?: unknown`, extend `ActionResult` to `{ ok: false; error; code?; fieldErrors?; details? }`, and let `fromError` copy `code` and `details` from the `ServiceError`. Update `src/__tests__/lib/action-result.test.ts`.
- **Error codes.** `ServiceError.code` strings from TS-§7 plus boilerplate ones; client islands switch on `result.code` for `CONFLICT`, `OPTION_REQUIRED`, `FUTURE_TIME`, `AI_TIMEOUT`, `AI_UNAVAILABLE`, `PHOTO_DISABLED`, `STORAGE_FULL`.
- **Rate limits and caps.** One in-process `rate-limit.service.ts` (sliding window) for sign-up/IP, uploads/user; AI caps counted from `AiCall` rows. Decision 010 documents the replica caveat.
- **AI notices.** `Profile.aiNotice{Plan,MealText,Photo}ShownAt`; `acknowledgeAiNoticeAction(kind)`; the UI decides to show the sheet when the timestamp is null.
- **Messages.** Group new keys by screen (`signup.*`, `onboarding.*`, `today.*`, `plan.*`, `meal.*`, `history.*`, `reflection.*`, `settings.*`, `errors.*`). Every PS-§12 copy row becomes a key with that exact text. Plural pairs `.one/.other` for counts ("N meals affected", "N of M meals").
- **Bidi.** Only `NameLabel` composes original + English. Inputs use `dir="auto"`. Numbers in system copy are Western digits (the `en` profile's `latn` handles this through `t()`).
- **Tests.** Service tests with `prismaMock` + factories; action tests mock the service module; pure libraries by fixtures; integration under `src/__tests__/integration/` (phase 11); e2e per journey with `t()` locators and the stub AI server. Coverage: raise `vitest` thresholds for `src/lib/rubric/**` and `src/lib/time/**` to 95% statements.
- **PRD.** Each phase's last task moves the relevant `_(planned)_` lines in `docs/PRD.md` to built and adds one sentence per new behaviour. Do not turn the PRD into a changelog.
- **Decision records.** 019 exists and 008/016 carry their amendments (2026-09-17); add a new record only when a rule changes again.

## 8. Verification per phase (definition of done)

Every task: `npm run lint:all`, `npm run test`, `npm run build` green; new strings in the
dictionary; exercised in the browser via Playwright MCP or covered by an e2e spec; PRD updated
when product-visible; beads issue closed after the user confirms.

| Phase | Proof beyond the standard gate                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `npx prisma migrate status` clean; rubric and time suites at ≥95% statements; a deliberate `import { prisma }` inside `lib/rubric` fails lint                                                                                                                                                                                                                                       |
| 2     | e2e: sign-up → onboarding resume → under-18 stop; no `/forgot` route exists; `curl -I /signup` is 200 without a cookie                                                                                                                                                                                                                                                              |
| 3     | Mobile project passes `locale.spec.ts`; 390×844 screenshot shows Log meal without scrolling; both themes render on `/components`; no theme flash with dark emulation                                                                                                                                                                                                                |
| 4     | e2e J1, J12, manual targets-only; fixture plans import with options, ranges, notes under "Not automatically tracked"; confirm line shows N when editing                                                                                                                                                                                                                             |
| 5     | Adapter tests for all eight failure/success cases; stub server drives e2e; `AiCall` rows written per attempt                                                                                                                                                                                                                                                                        |
| 6     | e2e J2, J3, J4, J11, double-save; `CONFLICT` path shows Reload keeping edits                                                                                                                                                                                                                                                                                                        |
| 7     | e2e J5, J7, J9; TS-§21.3–5 service tests; History summary sentence with denominators                                                                                                                                                                                                                                                                                                |
| 8     | Reflection appears once per day; stub failure → fallback; stale badge after a band change; integration single-flight test (phase 11)                                                                                                                                                                                                                                                |
| 9     | Upload of a fixture JPEG → analysis → save → photo visible via `/api/photos`; second account gets 404 on the first account's URL; HEIC on a real iPhone (manual, recorded)                                                                                                                                                                                                          |
| 10    | Change password logs out another context; export zip has the five entries; deletion refuses login and the purge task removes the row (integration)                                                                                                                                                                                                                                  |
| 11    | CI green with `quality`, `integration`, `e2e` (two projects), `docker` gated on all three; manual device pass on iPhone Safari (HEIC, numeric keyboards, Persian glyphs, a return after local midnight); measured time-to-save for a planned meal recorded in the runbook; image runs with `TZ=UTC` and `pg_dump` available; axe zero serious/critical; `npm run db:backup` uploads |

## 9. What this plan deliberately does not include

Anything in PS-§3 "Deferred" and TS-§1 "Non-goals": plan photo/PDF import, notifications or
email, diet generation, substitutions, coaching chat, water/exercise/weight widgets, training-day
handling, supplements, OTP/social sign-in, curated regional food table, multi-week rotations,
social features, subscriptions, native apps, plan versions, stored comparison caches, message
queues, more than one replica. If a task seems to need one of these, stop and raise it instead of
building it.

## 10. Review round of 2026-09-17 — what changed and why

A second reviewer raised 16 findings plus a table of smaller points. Each was checked against the
specs and the code before anything changed. Accepted findings were folded into the tasks above
(each carries a "review finding N" marker); this section records the disposition so the reasoning
is not lost.

| #   | Finding                                                                              | Verdict                         | Where it landed                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `migrate dev` applies before the SQL can be edited                                   | Accepted                        | 1.2: `--create-only`, explicit `AT TIME ZONE 'UTC'`, nullable-then-backfill-then-NOT NULL                                                                                                                                   |
| 2   | Nullable columns in unique keys allow duplicates                                     | Accepted (PostgreSQL default)   | 1.2: `PlanSlot.weekday` non-null with `7` = every day; `PlanTarget.scopeKey`                                                                                                                                                |
| 3   | Position-based identity re-links meals wrongly                                       | Accepted                        | 4.2: ids preserved in edit drafts, position is order only; TS-§5 and decision 017 amended                                                                                                                                   |
| 4   | Save retry cannot recover `clientRequestId`                                          | Accepted                        | 6.2: `saveMealAction` carries `clientRequestId`; lost-response test; TS-§7 amended                                                                                                                                          |
| 5   | Claim query races; raw names; `$executeRaw` misuse                                   | Accepted                        | 4.1: `FOR UPDATE SKIP LOCKED`, snake_case names, `$queryRaw` for `RETURNING`                                                                                                                                                |
| 6   | Older import can overwrite a newer draft                                             | Accepted                        | 4.1/4.2: `Plan.draftId` checked at finalize; `draftSourceText` separate from `sourceText`                                                                                                                                   |
| 7   | Baseline after confirm contradicts PS-§6                                             | Accepted (product spec wins)    | 4.2: baseline estimated and reviewed in the draft; `SUM_OF_MEALS` is a real sum; TS-§5.1 amended                                                                                                                            |
| 8   | Onboarding transitions incomplete                                                    | Accepted                        | 2.1/2.2: Profile created at `AGE`, full transition table, admins onboard like users, `demo` seed user                                                                                                                       |
| 9   | Auth paths not normalised                                                            | Accepted in part                | 2.1: one `usernameLower` rule for sign-up, login, throttle key, admin create, seed. The admin update path cannot change a username (`updateUserSchema` is `{ fullName, role }`), so that half of the finding does not apply |
| 10  | Counting `AiCall` rows is not an atomic cap                                          | Accepted                        | 5.1: caps count operations, `PENDING` admission row under a user-row lock, per-attempt metadata                                                                                                                             |
| 11  | Form recovery and stale analysis results                                             | Accepted                        | 6.1/6.3: `analysisRunId` + revision check; sessionStorage mirror per user, autosave, offline label                                                                                                                          |
| 12  | Reflection gaps (older edits, poll vs takeover, content checks, first-visit trigger) | Accepted                        | 8.1/8.2: candidates by `affectedDate + 1`, 25 s poll, numeric and banned-word checks, shell-level trigger                                                                                                                   |
| 13  | Weekly rules need the week, rule schemas undefined                                   | Accepted                        | 7.1: week range load, per-kind `definition` schemas, `FoodItem.ruleGroups`, `sameFood()`                                                                                                                                    |
| 14  | `APP_URL`/`DIRECT_DATABASE_URL` break CI and Docker                                  | Accepted                        | 1.1: CI, Dockerfile, compose and test setup updated in the same task                                                                                                                                                        |
| 15  | Deploy not gated; integration tests too late                                         | Accepted                        | 1.6 integration project in phase 1; 11.4 `needs: [quality, integration, e2e]`, rollback documented                                                                                                                          |
| 16  | Backups not encrypted, retention by count, media                                     | Accepted                        | 11.3/10.3: `openssl` encryption, age-based retention, photos-first order, purge deletes backup media                                                                                                                        |
| T1  | Task order: manual path before AI                                                    | Accepted                        | 4.4 split into 4.4a/4.4b, 6.6 added, 5.0 real-provider smoke, order in section 6                                                                                                                                            |
| T2  | `Intl.supportedValuesOf` lacks `UTC`                                                 | Accepted (verified on Node 24)  | 2.2: formatter-construction validation                                                                                                                                                                                      |
| T3  | Meal invariants (future date + null time, skipped slot)                              | Accepted                        | 6.2                                                                                                                                                                                                                         |
| T4  | Photo capacity at the target workload                                                | Accepted; see O13 below         | 9.3 and TS-§11: 1280 px / quality 0.8; capacity statement                                                                                                                                                                   |
| T5  | Performance: one transaction ≠ one round trip                                        | Accepted as wording             | 11.6 measures save and Today latency and query counts from Hamravesh, not only counts                                                                                                                                       |
| T6  | Safari/iPhone, midnight return, timing                                               | Accepted                        | Section 8 phase 11 row                                                                                                                                                                                                      |
| —   | "Not ready for full execution"                                                       | Agreed for the version reviewed | This revision closes every listed contract gap; the beads graph was re-wired to the new order                                                                                                                               |

**O13 — Photo capacity (decided 2026-09-17).** At the TS-§17 target workload (200 users × 5 meals × 1 photo per 3 meals ≈ 333 photos/day) even 250 KB photos fill the 1 GB free bucket in about twelve days. Therefore: the device pipeline downscales to a 1280 px maximum edge at JPEG quality 0.8 (≈ 120–250 KB; TS-§11 amended), the soft limit stays 700 MB with `STORAGE_FULL` handled gracefully, and photo logging is enabled only for a pilot of at most ~30 users on the free tier; enabling it for the full target workload requires the Supabase Pro storage upgrade (TS-§19.10 trigger). Recorded in `docs/PRD.md` defaults.
