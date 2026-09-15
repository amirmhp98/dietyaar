# AGENTS.md — dietyaar

Rules for any coding agent (Claude Code, Cursor, Codex, Copilot) working in this repository.
`CLAUDE.md` adds the Claude-specific workflow and tooling on top of this file.

## What this is

A locale-profile-driven web application built on Next.js 16 (App Router), React 19, Tailwind CSS 4,
Prisma 6 and PostgreSQL. One language: English / LTR / Gregorian.
Cookie sessions, no external auth provider. `docs/PRD.md` describes the product; read it before
making product decisions. `docs/decisions/` records why the big choices were made.

Framework docs matching the installed Next.js version are bundled at
`node_modules/next/dist/docs/`. Prefer them over training data.

## Before the first feature

While `docs/PRD.md` › _What it is_ still holds its placeholder comment, the product is not defined and
the docs still describe the template. Do not scaffold, model or build anything yet. The first session
does this instead:

1. **Get the requirements from the user**, in their words: what the product does and for whom; the
   main entities and how they relate; who may do what (are `ADMIN` / `USER` enough?); external
   systems (email, SMS, payment, files, other APIs); what must exist for a first release.
2. **Match them against "What ships, what does not" below.** Name every gap before building it;
   a gap that changes a rule gets a note in `docs/decisions/`.
3. **Write the product down** so nothing still reads as the template: fill _What it is_, _Users_,
   _Data model_ (planned) and _Roadmap_ in `docs/PRD.md`, replacing the lines its header flags as template defaults; replace the placeholder paragraph at the top
   of `README.md`; set `APP_DESCRIPTION` in `src/lib/app-config.ts`.
4. **Remove what the product will not use.** Keep the Users module: it is the reference pattern
   and working admin user management. Remind the user to change the seeded admin password
   (`admin` / `admin123`).
   - the placeholder dashboard `src/app/(app)/page.tsx` — replace it
   - the gallery `src/app/(app)/components/page.tsx` — keep only as a reference
   - `.claude/` — if Claude Code is not used
5. **Delete this section and the pointers to it**: the first bullet under _Workflow_ and the first
   row of the decision flow in `CLAUDE.md`, and the sentence under _Your first feature_ in
   `README.md` that describes this session (`grep -n 'Before the first feature' README.md CLAUDE.md`
   must come back empty). From here on the PRD is the product and the rest of this file is the
   engineering contract.

## What ships, what does not

Match a spec against this table before designing. "Not included" means it does not exist here in
any generic form; the last column says where it would go so the layering stays intact.

| Area          | Included                                                                                                                                                                              | Not included → where it would go                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | Username + password, httpOnly cookie sessions with hashed tokens (`@/lib/auth`, `auth.service.ts`), per-username login throttle (in-memory, one replica), `SKIP_AUTH` for UI-only dev | OAuth / SSO / OTP / magic links, self-service password reset, "remember me", Redis throttle → `auth.service.ts` plus a provider service under `services/`                     |
| Authorisation | Two roles `ADMIN` / `USER` (`UserRole` enum), `requireAuth()` / `requireAdmin()`; the admin layout and every admin page guard themselves                                              | Permissions, per-record ownership, more roles → extend the enum, add `requireRole()` to `@/lib/auth`, put ownership checks in services                                        |
| Users         | Admin list / create / edit / activate / deactivate / reset password; deactivation and reset revoke sessions; no paging (one `findMany`)                                               | Self-registration, profile page, avatars, paging or search → a module in the Users shape; paging is added to the service and the table together                               |
| Data          | Prisma 6 + PostgreSQL, committed migrations, seed, `prismaMock` and factories for unit tests, `ServiceError` for expected failures                                                    | Soft delete, audit log, multi-tenancy, full-text search, transactions helpers → schema + services per module; nothing generic exists                                          |
| UI            | Local shadcn kit behind one barrel, app shell (sidebar, header, theme toggle, Toaster), forms via `react-hook-form` + `FormField`, `<Ltr>`, `/components` gallery                     | Server-side data tables (paging, sorting, filtering), charts, rich text, file pickers, drag and drop → a component under `components/ui/`, exported from the barrel           |
| Locale        | One profile: language, direction, calendar, numerals, time zone, currency; `t()` / `tp()` dictionary; `@/lib/format` for numbers, dates, currency, relative time                      | Runtime language switching, per-user locale, translation management → out of scope by design (decision 003)                                                                   |
| Files, email  | —                                                                                                                                                                                     | Upload / storage, email, SMS, push → one service per provider under `services/`, keys through `env.ts`, called from actions or route handlers, never from components          |
| Background    | —                                                                                                                                                                                     | Cron, queues, scheduled jobs, inbound webhooks → route handler under `app/api/` (inbound) or an external scheduler calling one (outbound); long work stays out of the request |
| API           | `/api/health`; all mutations are server actions returning `ActionResult`                                                                                                              | REST / GraphQL for external clients, API keys, CORS → route handlers under `app/api/` with their own auth (sessions are cookie-only)                                          |
| Public pages  | `/login` only (`PUBLIC_ROUTES` in `src/proxy.ts`)                                                                                                                                     | Landing / marketing / public content → a route group outside `(app)` and its path added to `PUBLIC_ROUTES`                                                                    |
| Ops           | Docker image + compose, CI (lint, unit, build, e2e, image), Renovate, pino logging, security headers, health probe                                                                    | Error tracking, metrics, feature flags → `@/lib/logger` is the seam; config through `env.ts`                                                                                  |

## Layout of the code

```
src/
  app/
    layout.tsx        Document shell only: html/body, font, theme, DirectionProvider, Toaster
    (auth)/login/     Bare pages (no app chrome)
    (app)/            Authenticated area: layout.tsx runs requireAuth() and renders the shell
      admin/          Admin-only (admin/layout.tsx runs requireAdmin())
    api/health/       Readiness probe, excluded from auth
  actions/            Server actions: authorise → validate (zod) → call a service → revalidate
  services/           Business logic. Framework-free: no next/*, no React, no cookies
  components/
    ui/               Locally owned shadcn components (RTL mode); the only place UI primitives are imported
    UiComponents.tsx  Barrel: the single UI import surface for app code
    layout/           App shell: Sidebar, Header, Logo, providers
  lib/
    locale.ts         Locale profile (lang, dir, calendar, numerals, tz, currency) — source of truth
    t.ts              t() / tp() message lookup; strings live in src/messages/
    format.ts         Intl formatting: numbers, currency, dates, relative time, lists, plural, sort
    validations/      zod schemas per module, shared by server and client
    env.ts            Validated environment (server-only)
    auth.ts           getSession / requireAuth / requireAdmin (server-only)
    action-result.ts  ActionResult<T>, ok(), fail(), fromZodError(), fromError()
    errors.ts         ServiceError
    navigation.ts     Single nav config for sidebar and header title
    prisma.ts, logger.ts, session-cookie.ts, preferences.ts, app-config.ts, theme.ts, utils.ts
  messages/           User-facing strings: index.ts exports the project's one dictionary
  types/              Shared TypeScript types
  __tests__/          Vitest unit tests (mirrors src/) + factories + prisma mock
prisma/               schema.prisma, migrations/, seed.ts; prisma.config.ts at the root
e2e/                  Playwright config and specs (locators read copy through t())
scripts/              new-module.mjs scaffold
.claude/              Claude Code settings and vendored skills (committed on purpose)
```

**The reference module is Users**: `lib/validations/user.ts` → `services/user.service.ts` →
`actions/user.actions.ts` → `app/(app)/admin/users/*` → tests under `src/__tests__/` and `e2e/`.
`npm run new:module <name>` scaffolds a new module in the same shape.

## Layering (enforced by ESLint)

| Layer                                       | May import                                               | Must not import                                                                |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `components/**`, client islands in `app/**` | `@/components`, `@/lib` (non-server), `@/actions`, types | `@/lib/prisma`, `@/services/*`, `@prisma/client` values, UI primitive packages |
| `app/**/page.tsx`, `layout.tsx`, `route.ts` | services (reads), `@/lib/auth`, components               | `@/lib/prisma` directly                                                        |
| `actions/**`                                | services, `@/lib/*`, validations                         | components, `@/lib/prisma`                                                     |
| `services/**`                               | `@/lib/prisma`, `@/lib/env`, `@/lib/t`, other services   | `next/*`, `react`, components, actions                                         |
| `lib/**`                                    | other lib modules                                        | components, actions, services                                                  |
| `components/ui/**`                          | `@radix-ui/*`, `sonner`, `react-day-picker`, `input-otp` | — (the only place these may be imported)                                       |

Type-only imports are always allowed. `npm run lint` fails on violations.

## How a feature is built

1. **Scaffold**: `npm run new:module <name>` creates validation, service, action, page, client island and test stubs.
2. **Schema**: add the model to `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`. Commit the migration.
3. **Strings**: add keys to the dictionary in `src/messages/`. Components call `t('key')`; never inline text.
4. **Validation**: zod schemas in `src/lib/validations/<module>.ts` with `t()` messages. Shared by server and client.
5. **Service**: pure functions. Throw `ServiceError(t('...'), 'CODE')` for expected failures.
6. **Action**: `'use server'` file. `requireAuth`/`requireAdmin` → `schema.safeParse(input)` → service → `revalidatePath` → `ActionResult`. Inputs are typed `unknown`.
7. **UI**: server `page.tsx` calls `requireAuth()` itself, reads through the service, passes data down; client islands call actions and show `toast` on the result. Forms: `react-hook-form` + `zodResolver` + `FormField`.
8. **Tests**: service tests with `prismaMock` + factories; action tests mock the service; an e2e spec for the happy path using `t()` for locators.
9. **Nav**: add the route to `src/lib/navigation.ts`.

## Non-negotiable rules

### Database

- Never run `prisma db push --force-reset` or `prisma migrate reset`. If a migration warns about data loss, stop and ask.
- Every schema change ships with a migration under `prisma/migrations/`.
- Index foreign keys and common filters (`@@index`).

### Security

- Passwords: bcrypt, 12 rounds. Session cookies carry a random token; the database stores its SHA-256.
- Login is throttled per username (5 failures / 15 minutes) in `auth.service.ts`; swap the in-memory store for Redis when running several replicas.
- Every server action authorises first and validates with zod before touching a service.
- Pages guard their own data access (layouts and pages render in parallel).
- Server-only modules import `'server-only'`. Environment is read through `src/lib/env.ts`, never `process.env` in app code (the proxy is the one exception).
- User-facing error messages come from `ServiceError` or zod; unexpected errors are logged and replaced by `t('errors.unexpected')`.

### Locale and direction

- `src/lib/locale.ts` decides language, direction, calendar, numerals, time zone and currency (fixed at project setup). Never hardcode a direction, a BCP-47 tag, a numbering system or a calendar; read the profile.
- Strings go through `t()` / `tp()`. Numbers, dates and currency through `@/lib/format`.
- The UI kit is written with logical Tailwind utilities (`ms- me- ps- pe- start- end- border-s border-e rounded-s rounded-e text-start text-end`) and logical overlay sides (`side="start" | "end"` on Tooltip, Popover, DropdownMenu, Sheet content). Keep new code in the same style.

### UI

- Import from `@/components/UiComponents` or `@/components/ui/*`. Primitive packages are blocked elsewhere by lint.
- Theme colours come from CSS variables in `src/app/globals.css`; no hex colours in components.
- Icon-only buttons need `aria-label`. Form fields go through `FormField` so labels and errors are wired.

### Code style

- TypeScript strict. `npm run lint:all` = ESLint + `tsc` + Prettier; it must pass before you report done.
- camelCase functions/variables, PascalCase components/types, kebab-case files. `@/*` alias; no `../../` chains.
- Keep files small and named after what they export.

## Commands

| Command                                                  | What it does                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`                                            | Dev server on :3000                                                                        |
| `npm run db:up` / `db:migrate` / `db:deploy` / `db:seed` | Postgres via docker compose / create a migration / apply migrations / seed the first admin |
| `npm run new:module <name>`                              | Scaffold a module in the reference shape                                                   |
| `npm run lint:all`                                       | ESLint, typecheck, Prettier                                                     |
| `npm run test` / `test:coverage`                         | Vitest unit tests                                                                          |
| `npm run test:e2e`                                       | Playwright (needs Postgres; `PORT=3001` to run beside another dev server)                  |
| `npm run build`                                          | Production build (needs a syntactically valid `DATABASE_URL`)                              |
| `npm run deps:update`                                    | Bump dependencies to latest minor/patch (Renovate does this weekly in CI)                  |

## Definition of done

Build passes, `lint:all` passes, unit tests pass, the feature was exercised in the browser
(or an e2e spec covers it), every new string has a dictionary key, and `docs/PRD.md` reflects any
product-visible change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
