# dietyaar

_What this product does and for whom goes here: the "What it is" paragraph from `docs/PRD.md`.
It is written in the first agent session (`AGENTS.md` › Before the first feature)._

Next.js 16 · React 19 · Tailwind CSS 4 · Prisma 6 · PostgreSQL. One locale profile (see
"Locale and direction" below). Rules for coding agents are in `AGENTS.md` and `CLAUDE.md`.

## Quick start

Requirements: Node LTS (`.nvmrc`), Docker (for the local database) or any PostgreSQL 14+.

```bash
cp .env.example .env      # DATABASE_URL points at the docker-compose Postgres
npm ci && npm run db:generate
npm run db:up             # Postgres in Docker (or edit DATABASE_URL in .env)
npm run db:deploy         # apply migrations
npm run db:seed           # admin / admin123
npm run dev               # http://localhost:3000
```

Change the default admin password after the first login (Admin → Users → reset password).

**No database?** Set `SKIP_AUTH=true` in `.env` to skip login and run UI-only (development only).

Every environment variable is documented in `.env.example` and validated at boot by `src/lib/env.ts`.

## Your first feature

Open your coding agent in the project root (Claude Code reads `CLAUDE.md`; other agents read
`AGENTS.md`). While `docs/PRD.md` still holds its placeholders the agent will first ask what the
product is, write the answers into the PRD, this README and `src/lib/app-config.ts`, and match your
requirements against what the repository ships (`AGENTS.md` › "Before the first feature" and
"What ships, what does not"). Then describe the feature in product terms:

> Add an **invoices** module. An invoice has a number, a customer name, an amount, a status
> (draft / sent / paid) and a due date. Admins create and edit invoices; every signed-in user can
> see the list. Put it in the sidebar under a new "Sales" group.

The agent runs `npm run new:module invoice`, adds the Prisma model and migration, writes the
strings, validation, service, action, page and tests in the shape of the Users module, wires the
nav item, and finishes with `npm run lint:all`, `npm run test` and a check in the browser. That
sequence is spelled out in `AGENTS.md` under "How a feature is built", and the lint rules make the
layering hard to get wrong.

Doing it by hand follows the same steps: scaffold, model + `npm run db:migrate -- --name add-invoice`,
strings, validation, service, action, UI, tests, nav.

## Stack

| Layer    | Technology                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Next.js 16 App Router, React 19 (React Compiler), Tailwind CSS 4                                                             |
| UI       | Locally owned shadcn components generated in RTL mode, one import barrel                                                     |
| Locale   | One profile (`src/lib/locale.ts`) drives direction, calendar, numerals, time zone, currency; `t()` messages; Intl formatting |
| Backend  | Server Actions + route handlers, zod validation, framework-free services                                                     |
| Database | PostgreSQL via Prisma 6, migrations committed                                                                                |
| Auth     | Cookie sessions (hashed tokens), bcrypt, login throttling, ADMIN / USER roles                                                |
| Tests    | Vitest (unit, mocked Prisma), Playwright (e2e against a real DB, locale-aware)                                               |
| Ops      | Docker multi-stage image, docker-compose, GitHub Actions CI, Renovate                                                        |

## Project structure

```
src/
  app/
    layout.tsx        document shell (html/body, font, theme, direction)
    (auth)/login/     bare pages
    (app)/            authenticated shell; admin/ is admin-only
      admin/users/    ← reference module UI
    api/health/       readiness probe (no auth)
  actions/            server actions: authorise → validate → service → revalidate
  services/           business logic, framework-free
  components/         ui/ primitives · UiComponents.tsx barrel · layout/ shell
  lib/                locale, t, format, validations, env, auth, prisma, …
  messages/           index.ts + the project's one dictionary (fa.ts or en.ts)
  __tests__/          unit tests, factories, prisma mock
prisma/               schema, migrations, seed · prisma.config.ts at the root
e2e/                  Playwright config and specs
scripts/              new-module.mjs scaffold
docs/                 PRD, decision records, checklists
.claude/              settings.json + vendored skills for Claude Code
AGENTS.md             rules for any coding agent · CLAUDE.md adds the Claude workflow
```

The **Users** module (`lib/validations/user.ts` → `services/user.service.ts` → `actions/user.actions.ts`
→ `app/(app)/admin/users/`) is the pattern every feature copies. `npm run new:module <name>` scaffolds
a new one in the same shape; `AGENTS.md` walks through the steps.

## Common tasks

| I want to…                          | Do this                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a feature module                | `npm run new:module <name>`, then follow the printed next steps (see "Your first feature").                                                  |
| Add a page                          | Create `src/app/(app)/<route>/page.tsx`. It is behind login automatically; call `requireAuth()` in the page and read data through a service. |
| Add an admin-only page              | Put it under `src/app/(app)/admin/`; that layout runs `requireAdmin()`. Call it in the page too (layouts and pages render in parallel).      |
| Add a table                         | Add the model to `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`, commit the migration folder.                           |
| Add a user-facing string            | Add a key to the dictionary in `src/messages/`, read it with `t('key')` (or `tp()` for plurals). Never inline text.                          |
| Add a form                          | `react-hook-form` + `zodResolver` + `FormField`, schema in `src/lib/validations/`. Copy `src/app/(app)/admin/users/create-user-dialog.tsx`.  |
| Add a shadcn component              | `npx shadcn@latest add <name>` (`components.json` is in RTL mode), export it from `src/components/UiComponents.tsx`.                         |
| Add a sidebar item                  | Edit `NAV_GROUPS` in `src/lib/navigation.ts`; the header title follows.                                                                      |
| Change the app name or logo         | `src/lib/app-config.ts` (name, description) and `src/components/layout/Logo.tsx` (mark).                                                     |
| Change the brand colours            | The hue/saturation variables at the top of `src/app/globals.css`.                                                                            |
| Change the seeded admin             | Set `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` before `npm run db:seed`, or reset the password from Admin → Users after login.            |
| Run e2e beside a running dev server | `PORT=3001 npm run test:e2e`                                                                                                                 |
| Update dependencies                 | `npm run deps:update` (minor/patch) or `npm run deps:update:major` (interactive). Renovate opens the same PRs weekly.                        |

## Scripts

| Command                                                                      | Description                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                                            | Development server / production build / serve the build                             |
| `npm run new:module <name>`                                                  | Scaffold validation, service, action, page, client island and test                  |
| `npm run lint` · `typecheck` · `format`                                      | ESLint · `tsc` · Prettier                                                           |
| `npm run lint:all`                                                           | All of the above (CI gate)                                                          |
| `npm run test` · `test:watch` · `test:coverage`                              | Vitest                                                                              |
| `npm run test:e2e`                                                           | Playwright (needs Postgres; `PORT=3001 npm run test:e2e` beside another dev server) |
| `npm run db:up`                                                              | Start Postgres with docker compose                                                  |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` · `db:generate` | Prisma                                                                              |
| `npm run deps:update` · `deps:update:major` · `reinstall`                    | Dependency upkeep                                                                   |

## Locale and direction

One locale profile per project, set once in `src/lib/locale.ts`:

| Profile | Direction | Intl tag | Calendar  | Numerals     | Time zone | Currency |
| ------- | --------- | -------- | --------- | ------------ | --------- | -------- |
| `en`    | LTR       | `en-US`  | Gregorian | Latin digits | `UTC`     | USD      |

`<html lang dir>`, the `DirectionProvider`, the font, Playwright's browser locale, every formatter and
every `t()` string follow the profile. Rules that keep this working (logical utilities,
`side="start|end"`, `t()` for all strings, `<Ltr>` for inline Latin) are in `AGENTS.md`.

## Working with AI agents

- **Claude Code**: `CLAUDE.md` holds the workflow and the tooling table. `.claude/settings.json`
  pre-approves the safe commands and denies destructive Prisma commands. Skills under `.claude/skills/`
  are vendored with attribution (`SOURCE.md` in each).
- **Other agents** (Cursor, Codex, Copilot): read `AGENTS.md`.
- Framework docs matching the installed Next.js version are in `node_modules/next/dist/docs/`.
- `docs/decisions/` explains why the big choices were made, so nobody has to re-derive them.

## Troubleshooting

| Symptom                                                                     | Cause and fix                                                                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` fails with "lockfile out of sync" or "Cannot find native binding"  | An incremental `npm install` dropped optional platform packages from the lockfile (npm bug). Run `npm run reinstall`, which regenerates it from a clean install. |
| `npm run build` fails with "Invalid environment variables: DATABASE_URL"    | The build evaluates `src/lib/env.ts`. Any syntactically valid `postgresql://` URL will do; it is not connected to during the build.                              |
| `npm run db:up` fails: port 5432 already in use                             | A local Postgres is running. Either use it (edit `DATABASE_URL` in `.env`) or change the host port in `docker-compose.yml`.                                      |
| Direction, calendar or strings look wrong after editing `src/lib/locale.ts` | The profile is inlined at build time. Restart `npm run dev` or rebuild.                                                                                          |
| `npm run test:e2e` says the browser is missing                              | `npx playwright install chromium` once per machine.                                                                                                              |
| Prisma engine download fails (blocked network)                              | Set `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma` before `npm ci`; the Dockerfile already does.                                         |
| `apt-get` fails inside `docker build`                                       | Uncomment one of the Debian mirrors at the top of the `Dockerfile`.                                                                                              |
| A page renders a raw key like `invoices.title`                              | The key is missing from the dictionary. Development also logs `[t] missing message key`.                                                                         |
| ESLint: "import of `@/services/...` is restricted"                          | Components and client islands may not touch services or Prisma. Read through a server `page.tsx` and pass data down, or call a server action.                    |

## Deployment

`docker compose up --build` builds the standalone image, waits for Postgres, runs `prisma migrate deploy`
and starts the server. The image exposes `/api/health` for orchestrator probes. CI
(`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, the e2e suite against a Postgres
service, and a Docker image build on every push and pull request. Renovate (`renovate.json`) groups
dependency updates weekly.

## License

MIT. See `LICENSE`. Vendored skills carry their own licenses inside `.claude/skills/*/`.
