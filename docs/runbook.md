# Runbook

Operating notes for the one person who runs Dietyaar. The one-time setup checklist below comes
from `tech-spec.md` § 13; record each result here as it is done. Everything after the checklist
grows as incidents and routines happen.

## One-time setup checklist

Results are blank until the step is done. Do not build product code that touches data from the
cluster before step 2 is recorded (tech spec § 1, constraints).

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Date       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Create the Supabase project (region per § 19.1, default `eu-central-1`); disable the Data API; create role `dietyaar_app` with table privileges only; create bucket `dietyaar` (private) and S3 keys; enable `citext` and `pgcrypto`. Verify an anonymous REST call to the project is rejected. Create the Hamravesh backup bucket `dietyaar-backup` and key, the Darkube namespace, the Sentry project and the web app.                                                                                                     | Supabase part done, see "Supabase" below: project `dietyaar` (`uhevhxxyjhgldbmxyfmg`, `eu-central-1`, Postgres 17.6); Data API disabled (exposed schemas empty; REST with the `anon` key returns 401/503); role `dietyaar_app` (login, no DDL, `SELECT/INSERT/UPDATE/DELETE` on all tables plus default privileges for future ones); `pgcrypto` in `extensions`, `citext` in `public` by migration 0002; bucket `dietyaar` private; S3 key `dietyaar-app` created in the dashboard. Migrations 0001–0002 deployed. Verified from the dev machine: `select 1` and Prisma CRUD as `dietyaar_app` through the session pooler; put/head/list/get/delete on the bucket with prefix `prod/`. **Pending:** Hamravesh backup bucket `dietyaar-backup` and key, Darkube namespace, web app (no Sentry: owner decision). | 2026-09-17 |
| 2   | From the web app's terminal on Darkube: `psql "$DIRECT_DATABASE_URL" -c 'select 1'` and the same through `$DATABASE_URL`, round-trip time over 20 runs (record p50/p95 as `R`); S3 `ListObjects` against both buckets; `curl https://api.deepseek.com/models` with the key; `curl` the USDA search endpoint; confirm the DeepSeek request field that disables thinking; a request that sleeps 50 s through the public domain to measure the ingress timeout. If Supabase is unreachable, stop and apply § 19.2 / appendix A. | Reframed for the VPS (decision 026, 2026-09-21): Postgres runs on the same box as the app, so there is no cross-border `R` to measure there; on Vercel the function (`fra1`) and Supabase (`eu-central-1`) sit in the same region. DeepSeek: the smoke of 2026-09-17 sent `thinking: { type: 'disabled' }` (`services/ai/deepseek.ts`) and 10/10 calls passed, so the field is confirmed. **Pending:** an S3 `ListObjects` from the box against MinIO and the backup bucket (needs the bucket), the USDA `curl` (`USDA_LOOKUP_ENABLED=false`, not needed for launch), and the 50 s request through the public domain (Caddy sets no proxy timeout, see "VPS" › Ingress).                                                                                                                                       | 2026-09-21 |
| 3   | Upload a 10 MB file to `/api/uploads` through the public domain; record the ingress body limit.                                                                                                                                                                                                                                                                                                                                                                                                                              | VPS: `request_body max_size 12MB` in `deploy/vps/Caddyfile` (configured, not measured). Vercel: the platform's 4.5 MB request-body limit, enough for device-downscaled photos (< 1 MB, decision 011). **Pending:** the 10 MB upload through the public domain to confirm the Caddy value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-09-21 |
| 4   | Run `npm run ai:eval` on the deployment account; archive the report; compare with § 19.4 thresholds.                                                                                                                                                                                                                                                                                                                                                                                                                         | Run from a developer machine on 2026-09-18 and 2026-09-19 ("Evaluation harness" below), not from a deployment; the deployment env is the same key and model. **Pending:** the photo evaluation (20 photos) that gates `PHOTO_LOGGING_ENABLED`; the meal rows are still `reviewed: false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-09-19 |
| 5   | Run `npm run db:backup`; restore the dump into the second free Supabase project; point a local app at it; sign in as a test user, open the plan, open a photo restored from the backup bucket, confirm a day's totals match. Record how long it took.                                                                                                                                                                                                                                                                        | **Pending**, blocked on the Hamravesh bucket and key (`BACKUP_ENABLED=false` on the VPS). The VPS-shaped manual backup and restore steps are under "Backups"; run them once the bucket exists and record the time here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |            |
| 6   | Confirm `/api/health` and `/api/live` return 200 and Loki shows the startup line.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `/api/health` and `/api/live` return 200 on `https://85-198-48-114.sslip.io` (checked 2026-09-21 from the dev machine, 0.25 s) and `/api/health` 200 on `https://dietyaar.vercel.app`. The `deploy-vps` job repeats the health check after every deploy. No Loki on the VPS: the startup line is in `docker compose logs app`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-09-21 |

### Measured values

Development does not wait for these: the default in the last column applies until the step is done.

| Value                                   | Result                                                                                                                                                      | Where it is used                                            | Default until measured                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Cross-border round trip `R` (p50 / p95) | VPS: none (Postgres on the same box, decision 026). Vercel `fra1` ↔ Supabase `eu-central-1`: same region. Dev machine via VPN, session pooler: 113 / 257 ms | § 17 query budgets; review gate if `R` > 150 ms             | assume 150 ms; budgets as written                       |
| Ingress request timeout                 | VPS: Caddy sets none, Node default 300 s (not measured). Vercel: Fluid compute, up to 300 s                                                                 | § 20: if below 45 s, meal analysis moves to the job pattern | assume ≥ 60 s; meal analysis stays a server action      |
| Ingress body limit                      | VPS: 12 MB (`deploy/vps/Caddyfile`, not measured). Vercel: 4.5 MB (platform)                                                                                | § 11                                                        | assume ≥ 10 MB; device downscaling keeps uploads < 1 MB |
| DeepSeek field that disables thinking   | `thinking: { type: 'disabled' }` accepted by the real API (smoke 2026-09-17, 10/10)                                                                         | `services/ai/deepseek.ts`                                   | `thinking: { type: 'disabled' }`                        |
| Supabase Postgres major version         | 17 (17.6.1); VPS `postgres:17-alpine`                                                                                                                       | `Dockerfile` (`postgresql-client` version)                  | 17                                                      |

### Real-provider smoke (implementation plan task 5.0)

`DEEPSEEK_API_BASE_URL=https://api.deepseek.com npx tsx --conditions=react-server scripts/ai-smoke.ts`
with a real `DEEPSEEK_API_KEY` in `.env`. Run on 2026-09-17 from a developer machine (not yet from
Darkube): 10/10 calls passed the schemas. Latency and tokens (prompt+completion):

| Call                              | Latency   | Tokens        |
| --------------------------------- | --------- | ------------- |
| PLAN_IMPORT menu plan (5 slots)   | 14.0 s    | 3458 + 5117   |
| PLAN_BASELINE menu plan           | 12.7 s    | 4130 + 4509   |
| PLAN_IMPORT weekday plan (7 days) | 33.2 s    | 22529 + 11612 |
| PLAN_BASELINE weekday plan        | 22.9 s    | 8401 + 8298   |
| MEAL_TEXT (five Persian meals)    | 1.8–2.5 s | ~1790 + ~600  |
| REFLECTION                        | 1.1 s     | 840 + 85      |

Finding: one baseline call for a 35-slot plan overflowed the 6,000-token output cap
(`INVALID_JSON`); `estimatePlanBaseline` now batches 20 items per call inside the operation
deadline.

### Evaluation harness (tech spec § 10.5, implementation plan task 11.5)

`DEEPSEEK_API_BASE_URL=https://api.deepseek.com npm run ai:eval` (add `-- --meals-only` to skip
the plans and reflections). Fixtures: `src/__tests__/fixtures/ai-eval/` — both reference plans,
88 Persian meal descriptions with expected items (40 free-text `OFF_PLAN`, 13 `MENU_PLAN` = every
option of every slot of the menu plan verbatim, 35 `WEEKDAY_PLAN` = every slot of every weekday
verbatim; all `reviewed: false` until the owner checks them; the recall threshold is read only
from reviewed rows — O11), and every reflection state with the fact ids the paragraph must draw
on. Thresholds are tech spec § 19 item 4. Not in CI. Since A2 a food counts as recalled only when
it has its own returned item: two named foods folded into one item recall one food (the first
run's substring check let "Oatmeal with milk" count as both oats and milk).

First run on 2026-09-18 (developer machine, `deepseek-flash`, 49 calls, ≈ $0.06):

| Metric                     | Result                                                                                                                                                                                        | Threshold             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Schema pass                | 48/49 (one `PLAN_IMPORT` weekday reply `INVALID_JSON`; the smoke passed the same plan the day before — an occasional empty/invalid reply, surfaced to the user as a failed import with Retry) | 98 %                  |
| Expected-item recall (all) | 96.4 % (misses: an omitted "milk", "barberry rice" labelled as one dish)                                                                                                                      | 85 % on reviewed rows |
| Unit resolution            | 91.4 % of quantified items use a unit-table key                                                                                                                                               | 90 %                  |
| Unsupported facts          | 0/6 reflections; 6/6 used the expected facts                                                                                                                                                  | ≤ 2 %                 |
| Meal latency               | p50 2.1 s · p75 2.7 s · p95 3.2–4.5 s                                                                                                                                                         | p75 ≤ 15 s            |

Observations for the owner: the model returns `کف دست` / `kaf dast` (a palm of bread) and
`estekan` (tea glass) as free-text units because the unit table (product spec § 6) has no such
entries — users write both often, so adding them to the table (with an assumed weight/volume)
would raise unit resolution further; the assumed-default keys `yogurt_bowl` / `tea_sweet`
sometimes come back in the `unit` field instead of `assumedDefaultKey`.

#### Second run, 2026-09-19 (improvement plan A2/A3): the reference-plan meals

Meals only, 88 meals per run, `deepseek-flash`, developer machine, ≈ $0.09 per run. "Before" is
`MEAL_TEXT` prompt v1, "after" is v2 (the item-per-food rules below). Recall is the one-item-per-food
definition; the before numbers were recomputed from the v1 run's returned labels with it.

| Metric                       | Before (v1)               | After (v2)                | Threshold   |
| ---------------------------- | ------------------------- | ------------------------- | ----------- |
| Schema pass                  | 88/88                     | 88/88                     | 98 %        |
| Expected-item recall (all)   | 97.2 % (175/180)          | 98.9 % (178/180)          | 85 % rev.   |
| Recall `OFF_PLAN` (40 meals) | 94.0 % (79/84) — 5 merges | 97.6 % (82/84) — 2 merges |             |
| Recall `MENU_PLAN` (13)      | 100 % (31/31)             | 100 % (31/31)             |             |
| Recall `WEEKDAY_PLAN` (35)   | 100 % (65/65)             | 100 % (65/65)             |             |
| Unit resolution              | 91.7 %                    | 91.8 %                    | 90 %        |
| Meal latency p50 / p75 / p95 | 2.1 / 2.6 / 3.0 s         | 2.1 / 2.6 / 3.2 s         | p75 ≤ 15 s  |
| Slot suggestion (5 probes)   | —                         | 5/5 slot and option       | 5/5 (O 3.5) |

Every plan-verbatim meal (menu options and weekday slots) came back with every food as its own
item in both runs; not one side, drink or condiment was dropped. The prompt-quality complaint of
the walkthrough is therefore explained by the stub (root cause 1), not by the model. The merges
were all in the free-text set:

**Per-meal misses, before (v1)** — each is two named foods returned as one item:

| Fixture text                            | Returned instead                                                           |
| --------------------------------------- | -------------------------------------------------------------------------- |
| یک کاسه جو دوسر با شیر و یک موز کوچک    | "Oatmeal with milk" (oats + milk as one), "Small banana"                   |
| یک بشقاب چلو خورشت قیمه با سالاد شیرازی | "Chelo khoresh gheymeh (rice with gheymeh stew)" as one, "Shirazi salad"   |
| چلوکباب کوبیده با گوجه کبابی و دوغ      | "Chelo kabab koobideh (rice with ground meat kabab)" as one, tomato, doogh |
| زرشک پلو با مرغ                         | "Barberry rice with chicken" as one                                        |
| سالاد سزار با مرغ گریل                  | "Caesar salad with grilled chicken" as one                                 |

**Per-meal misses, after (v2)** — the first three now split (Oats / Milk; White rice / Gheymeh
stew; Zereshk polo / Chicken); two remain, both named compound dishes:

| Fixture text                       | Returned instead                                              | Cause                                                  |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| چلوکباب کوبیده با گوجه کبابی و دوغ | "Chelo kabab koobideh" as one item, "Grilled tomato", "Doogh" | چلوکباب is a single dish name; the rice is folded in   |
| سالاد سزار با مرغ گریل             | "Caesar salad with grilled chicken" as one item               | the chicken is read as the salad's topping, not a side |

One further v2 "miss" was a fixture keyword (`soda` vs the returned "Soft drink"); the keyword now
accepts both. Not counted: خیار و گوجه comes back as one item ("Cucumber and tomato", the
`cucumber_tomato` assumed default) or as two, run by run; the fixture accepts either.

Prompt change (v2, `MEAL_COMMON_RULES`, shared by `MEAL_TEXT` and `MEAL_PHOTO`, both bumped to
v2): every named food is its own item — never merge two named foods, never drop a side, drink or
condiment; a phrase naming several foods is one item per food unless the assumed-defaults table
lists that phrase as one; a dish named with its ingredient count (املت 2 تخم‌مرغ) stays one item;
and a final self-check that `items` has one entry per named food.

For the owner: review `expectedItems` in `meals.ts` and flip `reviewed: true` so the threshold
line reads from real rows; decide whether چلوکباب / سالاد سزار should split (if yes, the two
dishes go into the prompt's examples; if no, their fixtures get one keyword). The tea-glass and
palm-of-bread unit observation above still stands.

### Query counts (implementation plan task 11.6)

Measured in development on 2026-09-18 with `PRISMA_LOG_QUERIES=true` against the local database,
one user with a menu plan and one recorded meal. SQL statements per read model, before and after
enabling Prisma `relationJoins` (decision 020):

| Read model                         | Tech spec § 17 budget | Before | After |
| ---------------------------------- | --------------------- | ------ | ----- |
| Today (`getDayView` + message)     | 3                     | 14     | 4     |
| History 7 days (`getSevenDayView`) | 2                     | 13     | 3     |
| History day (`listMealsForDate`)   | —                     | 6      | 1     |
| Composer recent meals              | —                     | 3      | 1     |
| Save meal                          | 1 transaction         | 1 txn  | 1 txn |

Today's fourth statement is the profile read (`requireProfile`) the page does before the day; the
session lookup in `requireAuth` adds one more per request. The "before" numbers came from Prisma
loading each relation level in its own statement, mostly sequentially, so with the measured
cross-border `R` (113–257 ms) a Today render would have cost 1–3 s in round trips. On the VPS the
database is on the same box (decision 026), so `R` is a local hop; the 150 ms assumption only
matters for the Vercel/Supabase pair, which shares a region.

## Environments

| Name         | Where                     | Database                                    | Storage                                                | Notes                                                                   |
| ------------ | ------------------------- | ------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Local        | `npm run dev`             | docker-compose Postgres (`npm run db:up`)   | MinIO `dietyaar-dev` (`npm run storage:up`), `dev/`    | `SKIP_AUTH=true` for UI-only work                                       |
| CI e2e       | GitHub Actions `e2e` job  | `postgres:16-alpine` service container      | the same MinIO from `docker-compose.yml`, prefix `ci/` | `.github/workflows/ci.yml`; see "CI" below                              |
| Production   | VPS `85.198.48.114`       | Postgres 17 container on the box            | MinIO container, bucket `dietyaar`, `prod/`            | `https://85-198-48-114.sslip.io`; decision 026                          |
| Staging      | Vercel `dietyaar`         | Supabase project `uhevhxxyjhgldbmxyfmg`     | Supabase bucket `dietyaar`, prefix `vercel/`           | `https://dietyaar.vercel.app`; decision 021                             |
| Darkube      | Darkube app `dietyaar`    | same Supabase project                       | same Supabase bucket, prefix `prod/`                   | Never created; superseded by the VPS for launch. `DARKUBE_ENABLED` gate |
| Restore test | local app or a scratch db | `npm run db:up` (or a container on the box) | local MinIO (or the VPS MinIO)                         | Used only for the step 5 rehearsal, see "Backups"                       |

### Environment variables by target

Every variable is validated by `src/lib/env.ts` and listed in `.env.example`; this table records
where each photo-storage and flag value lives per target, because the answer differs: on the VPS
the five `S3_*` values are written by `deploy/vps/docker-compose.yml` itself (they point at the
MinIO service on the compose network and must not be repeated in `/opt/dietyaar/.env`), on Vercel
they are project environment variables (Production and Preview, secrets marked sensitive), locally
and in CI they are the MinIO defaults from `.env.example` / the `e2e` job's `env:` block.

| Variable                   | Local (`.env`)              | CI e2e (`ci.yml`)             | Vercel (project env)                                             | VPS (`/opt/dietyaar`)                               |
| -------------------------- | --------------------------- | ----------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `S3_ENDPOINT`              | `http://localhost:9000`     | `http://localhost:9000`       | `https://uhevhxxyjhgldbmxyfmg.storage.supabase.co/storage/v1/s3` | `http://minio:9000` (compose file)                  |
| `S3_REGION`                | `us-east-1`                 | `us-east-1`                   | `eu-central-1`                                                   | `us-east-1` (compose file)                          |
| `S3_BUCKET`                | `dietyaar-dev`              | `dietyaar-dev`                | `dietyaar`                                                       | `dietyaar` (compose file; `minio-init` creates it)  |
| `S3_ACCESS_KEY_ID`         | `dietyaar`                  | `dietyaar`                    | Supabase S3 key `dietyaar-app` (dashboard)                       | `${MINIO_ROOT_USER}` from `.env` (compose file)     |
| `S3_SECRET_ACCESS_KEY`     | `dietyaar-dev-secret`       | `dietyaar-dev-secret`         | secret of that key                                               | `${MINIO_ROOT_PASSWORD}` from `.env` (compose file) |
| `S3_KEY_PREFIX`            | `dev/`                      | `ci/`                         | `vercel/`                                                        | `prod/` (compose file)                              |
| `STORAGE_SOFT_LIMIT_BYTES` | default (700 MB)            | default                       | default                                                          | `734003200` in `.env`; raise when the disk allows   |
| `PHOTO_LOGGING_ENABLED`    | `false` (`true` to try it)  | `true` (job env + Playwright) | `true` (staging shows the photo path)                            | `false` in `.env` until the photo evaluation passes |
| `SCHEDULER_ENABLED`        | `true`                      | `true`                        | `false` (`CRON_SECRET` + `vercel.json` cron instead)             | `true` in `.env`, no `CRON_SECRET`                  |
| `BACKUP_ENABLED`           | `true` (no-op without keys) | not set                       | `false` (no `pg_dump` in a function)                             | `false` in `.env` until the Hamravesh bucket exists |

Changing a value: locally edit `.env`; in CI edit the job's `env:` block (and `docker-compose.yml`
if the MinIO credentials change); on Vercel `vercel env add` or the dashboard, then redeploy; on
the VPS edit `/opt/dietyaar/.env` and `docker compose up -d app` (the `S3_*` lines are in the
compose file, so a bucket or credential change there is a compose-file edit plus
`docker compose up -d`).

### Local AI

`npm run dev` talks to the real DeepSeek API (`DEEPSEEK_API_BASE_URL=https://api.deepseek.com`
and a real key in `.env`), so meals and plans parsed locally go through the real model and every
`AiCall` row shows it (improvement plan A1; before 2026-09-19 `.env` pointed at the e2e stub, which
knows ~20 foods and ignores the rest). Offline or without a key: `npm run dev:stub` starts
`e2e/stub-ai/server.mjs` on 3999 and `next dev` pointed at it, and stops both together. The e2e
suite always runs on the stub: `e2e/playwright.config.ts` starts its own and overrides the URL, whatever
`.env` says.

### Local photo storage

`npm run storage:up` starts MinIO from `docker-compose.yml` (API `localhost:9000`, console
`localhost:9001`, user `dietyaar` / `dietyaar-dev-secret`) and a one-shot `minio-init` that creates
the `dietyaar-dev` bucket. The five `S3_*` values in `.env.example` point at it with
`S3_KEY_PREFIX=dev/`; with `PHOTO_LOGGING_ENABLED=true` the composer's photo actions upload for
real. CI starts the same two services for the e2e job (`e2e/photo.spec.ts`), prefix `ci/`.

## Supabase

Project `dietyaar`, ref `uhevhxxyjhgldbmxyfmg`, org "Bozhan" (free plan), region `eu-central-1`,
created 2026-09-17. Dashboard: `https://supabase.com/dashboard/project/uhevhxxyjhgldbmxyfmg`.

| Item                | Value                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App connection      | `dietyaar_app.uhevhxxyjhgldbmxyfmg@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`, `?pgbouncer=true&connection_limit=5&sslmode=require`         |
| Migrations, pg_dump | `postgres.uhevhxxyjhgldbmxyfmg@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, `?sslmode=require`                                               |
| Role `dietyaar_app` | `LOGIN NOINHERIT`, no `CREATEDB/CREATEROLE`; `USAGE` on `public` and `extensions`; DML on all tables and sequences; default privileges from `postgres` |
| Data API            | Disabled (`PATCH /v1/projects/{ref}/postgrest {"db_schema": ""}`). Legacy `anon` / `service_role` keys still exist but are not used anywhere.          |
| Storage             | Bucket `dietyaar`, private, no size or MIME restriction at bucket level. S3 endpoint `https://uhevhxxyjhgldbmxyfmg.storage.supabase.co/storage/v1/s3`. |
| Secrets             | `.env.production.local` (git-ignored) holds both URLs and the S3 keys; the two passwords are also in `~/.supabase/dietyaar-*-password`.                |
| Management access   | Personal access token in `~/.supabase/access-token`; `POST /v1/projects/{ref}/database/query` runs SQL as `postgres`.                                  |

Notes from setup:

- The dev machine reaches the pooler only through a VPN that forwards 5432 and 443 but not 6543,
  so the transaction pooler (the app's `DATABASE_URL`) could not be tested locally; step 2 does it
  from Darkube. Local checks used the session pooler with the same role.
- S3 access keys cannot be created through the Management API; use the dashboard
  (Project Settings → Storage → S3 access keys).
- `citext` is installed by migration 0002 into `public` (matching local dev), not into
  `extensions`; `dietyaar_app` has `search_path = public, extensions`.
- Future migrations run as `postgres`, so tables they create are covered by the default
  privileges above. A migration that creates a schema other than `public` needs its own grants.

## Routines

- **Deploy.** Push to `main`; CI builds the image, pushes it to GHCR and the `deploy-vps` job
  restarts the stack on the VPS (and calls `darkube deploy` when `DARKUBE_ENABLED=true`). Readiness
  is `/api/health`. Migrations run at container start with `lock_timeout = 5s`.
- **Before a destructive migration.** `npm run db:backup`, confirm the object exists, then deploy.
- **Flip a flag.** Edit `/opt/dietyaar/.env` on the VPS (`PHOTO_LOGGING_ENABLED`,
  `USDA_LOOKUP_ENABLED`, …) and `docker compose up -d app`; no deploy. On Darkube: the app env.
- **Weekly.** Run the analytics SQL (§ 16) and check the size gauges against the § 19.10 upgrade
  trigger: database over 400 MB, storage over 700 MB, egress over 4 GB per month.
- **If the Supabase project was paused** (replicas were zero for 7 days): unpause it in the
  dashboard, then restart the app.

## Deploy and rollback

### CI (`.github/workflows/ci.yml`)

Every push and pull request runs `quality` (lint, typecheck, unit tests with coverage, build),
`integration` (`scripts/test-integration.mjs` against a Postgres service container), `e2e` and
`migrations` (`scripts/check-migrations.mjs`); `docker` then builds the image, smoke-tests
`/api/health`, `/api/live` and `pg_dump --version` in a container, and on a push to `main` pushes
`ghcr.io/amirmhp98/dietyaar:<short sha>` and `:latest`, after which `deploy-vps` restarts the VPS
stack (below). The Darkube push and deploy stay in the file but are skipped until
`HAMDOCKER_ORG` / `DARKUBE_ENABLED` exist.

The `e2e` job runs every Playwright project (setup, auth, chromium, mobile) against the stub AI
server with `PHOTO_LOGGING_ENABLED=true` and the five `S3_*` values of `.env.example` (prefix
`ci/`). Photo storage comes from the repo's own `docker-compose.yml`: a step runs
`npm run storage:up` (MinIO plus the one-shot `minio-init` that creates `dietyaar-dev`) and waits
for `docker wait dietyaar-minio-init` to return 0 before `npm run test:e2e`, so `e2e/photo.spec.ts`
uploads for real, exactly as it does locally. MinIO is not a `services:` container because those
cannot set the `server /data` command. `docker compose up -d minio minio-init` works without a
`.env` in the checkout (compose only resolves the `web` service's `env_file` when `web` is
selected; verified with Compose 2.40, the runner has 2.38). Failed runs upload
`playwright-report` for 7 days.

### Vercel (staging, decision 021)

Project `dietyaar` in team `amirmhps-projects` (Hobby), created 2026-09-19 with `vercel link`,
paired with GitHub `amirmhp98/dietyaar`: every push to `main` deploys production, other branches
get previews. Region `fra1` (Supabase is `eu-central-1`). Build: `npm run vercel-build`. Env vars
(Production and Preview, secrets marked sensitive): `APP_URL=https://dietyaar.vercel.app`,
`DATABASE_URL`, `DIRECT_DATABASE_URL`, `S3_*` with `S3_KEY_PREFIX=vercel/`, `DEEPSEEK_*`,
`PHOTO_LOGGING_ENABLED=true`, `SCHEDULER_ENABLED=false`, `BACKUP_ENABLED=false`, `LOG_LEVEL=info`,
`CRON_SECRET` (copy in `~/.supabase/dietyaar-vercel-cron-secret`). `vercel.json` schedules
`/api/cron/all` at 04:00 UTC. Manual deploy from the working tree: `vercel deploy --prod`; rollback:
`vercel rollback` or promote an earlier deployment in the dashboard. Verified 2026-09-19 from
`fra1`: `/api/health` 200 through the transaction pooler (port 6543, untestable from the dev
machine), sign-up, onboarding and an AI plan import through `after()`, cron route 401/404/200, no
console errors. The MCP server `https://mcp.vercel.com` is listed in `.mcp.json` for inspection.

### VPS (production, decision 026)

Server `85.198.48.114` (Ubuntu 24.04, 2 vCPU / 4 GB / 23 GB, UTC), set up 2026-09-19: 2 GB swap
file, `ufw` allowing 22/80/443, `fail2ban` on sshd, key-only SSH (`~/.ssh/id_ed25519_dietyaar`,
host alias `dietyaar` in `~/.ssh/config`), unattended security upgrades, Docker CE with
`hub.hamdocker.ir` as the Docker Hub mirror (Hub refuses `minio/*` from this IP). The stack is
`deploy/vps/docker-compose.yml` copied to `/opt/dietyaar/` with `Caddyfile` and a `.env` filled
from `deploy/vps/.env.example` (Postgres and MinIO passwords generated on the server; the DeepSeek
key is the one in the dev `.env`). Caddy holds a Let's Encrypt certificate for
`85-198-48-114.sslip.io`; when a real domain exists, point an `A` record at the server, change
`DOMAIN` and `APP_URL` in `.env`, and `docker compose up -d`.

CI: `docker` pushes `ghcr.io/amirmhp98/dietyaar:<short sha>` and `:latest`; `deploy-vps` SSHes in
with the deploy key (GitHub secrets `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `VPS_HOST`; the public key is
in the server's `authorized_keys` as `github-actions@dietyaar`), logs the server in to GHCR with the
job token, pins the tag in `.env`, pulls, restarts and waits for `/api/health` over HTTPS. The
first push to `main` after 2026-09-19 is the first time the job runs; until then the stack on the
box was started by hand.

**Rollback.** `ssh dietyaar`, then in `/opt/dietyaar`: set `IMAGE=ghcr.io/amirmhp98/dietyaar:<previous
short sha>` in `.env`, `docker login ghcr.io` with a token that can read packages,
`docker compose pull app && docker compose up -d app`. Migrations are backward compatible with
the previous release (tech spec § 13: add nullable, backfill, tighten later) and the migration gate
refuses `DROP` / `ALTER … TYPE` without a decision record, so the older image runs against the
newer schema; if that migration must go, restore from the last dump instead ("Backups").

**Operating.** `docker compose logs -f app`; `docker compose exec db psql -U postgres app`;
`docker system df` for disk. Upgrade the plan when `free -h` shows available memory under 500 MB
for more than a few minutes, load average stays above the vCPU count, or `df -h /` passes 80%.
Open items: `BACKUP_ENABLED=false` until the Hamravesh backup bucket and key exist (decision 018;
until then the box holds the only copy of the data, so this comes before real users);
`PHOTO_LOGGING_ENABLED=false` until the vision evaluation passes (§ 19.4).

**Ingress.** Caddy terminates TLS and proxies to `app:3000` with no proxy timeout of its own
(none is set in `Caddyfile`; Node's default `requestTimeout` is 300 s), so the 45 s meal-analysis
deadline is not cut short; `request_body max_size 12MB` is the body limit. Neither has been
measured through the public domain yet (setup checklist steps 2–3).

### Darkube (not created; superseded for launch)

Decisions 021 and 026 replaced Darkube as the launch target; the `deploy` job and the
`registry.hamdocker.ir` push stay in `ci.yml` behind the repository variable `DARKUBE_ENABLED`
and the `HAMDOCKER_*` secrets so the pipeline is green without them. If it is ever revived: create
the namespace and web app per tech spec § 13, set the GitHub secrets `HAMDOCKER_ORG`,
`HAMDOCKER_USERNAME`, `HAMDOCKER_PASSWORD` (container registry page of the Hamravesh console),
`DARKUBE_DEPLOY_TOKEN`, `DARKUBE_APP_ID` (app profile page), the app env from the table above with
the Supabase values of the Vercel column and `S3_KEY_PREFIX=prod/`, then set `DARKUBE_ENABLED=true`.

**Rollback.** Every release image stays in the registry under its short SHA. To go back:

```sh
docker run --rm hamravesh.hamdocker.ir/public/darkube-cli:v1.1 \
  darkube deploy --ref main --token "$DARKUBE_DEPLOY_TOKEN" --app-id "$DARKUBE_APP_ID" \
  --image-tag <previous short sha> --job-id manual-rollback --stateless-app true
```

The same migration caveat as the VPS rollback applies. _Verify once a first deploy has run:_ the
exact `darkube deploy` flags and the `--stateless-app` value against the Darkube console; the same
`PUT https://api.console.hamravesh.ir/api/v1/darkube/apps/update_from_cli/` endpoint with
`{ "trigger_deploy_token", "app_id", "image_tag" }` is the documented `curl` alternative.

## Backups

Nightly at 03:00 UTC the in-process `backup` task (`src/services/jobs/backup.job.ts`,
decision 018) copies every `ATTACHED` photo the backup bucket lacks to `photos/{key}`, then
runs `pg_dump --format=custom` against `DIRECT_DATABASE_URL`, gzips it, encrypts it with
`openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY` and uploads
`db/{YYYY-MM-DD}.dump.gz.enc` to the Hamravesh bucket `dietyaar-backup`. Dumps older than
`BACKUP_RETENTION_DAYS` (30) are deleted; the newest is always kept. The account purge deletes a
user's `photos/{key}` copies, so with the 30-day retention every trace of a deleted account is gone
from the backups within 30 days (product spec § 15). Success logs one `backup finished` line with
`dumpBytes` and `durationMs`; failure logs `backup_failed` (on the VPS:
`docker compose logs --since 24h app | grep backup`; Grafana alert when a Loki stack exists, § 16).

**Status (2026-09-21).** The job is built and unit-tested but has never run against a real
bucket: the Hamravesh bucket `dietyaar-backup` and its key do not exist yet, so `BACKUP_ENABLED`
is `false` on the VPS and on Vercel (Vercel functions have no `pg_dump`; decision 021). On the
VPS this means the Postgres and MinIO volumes on the box are the only copy of user data. Order
of work: create the bucket and key (Hamravesh console), put `BACKUP_S3_*`, `BACKUP_ENCRYPTION_KEY`
and `BACKUP_ENABLED=true` in `/opt/dietyaar/.env`, `docker compose up -d app`, wait for the
03:00 UTC run (nothing on the box triggers it earlier; the manual path below takes a copy
without the bucket), confirm `backup finished` in `docker compose logs app` and the object in
the bucket, then do the restore rehearsal.

**Encryption key.** `BACKUP_ENCRYPTION_KEY` is a long random passphrase generated once
(`openssl rand -base64 48`), stored in `/opt/dietyaar/.env` on the VPS (a Darkube secret env if
that target is revived) and in the owner's password manager. Losing it makes every dump
unreadable; rotating it does not re-encrypt old dumps, so keep the previous key until those have
expired.

**Manual backup** (before a destructive migration, or for the rehearsal). From a machine that can
reach the database, the script runs the nightly pipeline once:

```sh
DOTENV_CONFIG_PATH=.env.production.local npm run db:backup   # needs pg_dump 17, gzip, openssl on PATH
```

Prints the result JSON (`dumpKey`, `dumpBytes`, `photosCopied`, `dumpsDeleted`) and exits 1 on
failure. That path fits Vercel/Supabase. On the VPS the database is not published outside the
compose network and the image has `pg_dump` but not `tsx`, so a manual copy is taken on the box
and encrypted the same way the job does:

```sh
ssh dietyaar
cd /opt/dietyaar && export BACKUP_ENCRYPTION_KEY="$(grep '^BACKUP_ENCRYPTION_KEY=' .env | cut -d= -f2-)"
docker compose exec -T db pg_dump -U postgres --format=custom app | gzip -c \
  | openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  > "/root/manual-$(date -u +%F).dump.gz.enc"
# Photos: the MinIO volume, as a tarball next to it.
docker run --rm -v dietyaar_minio-data:/data -v /root:/out alpine \
  tar czf "/out/manual-$(date -u +%F)-photos.tgz" -C /data .
```

Copy both files off the box (`scp dietyaar:/root/manual-*.{enc,tgz} .`) and delete them there.
The scheduled task itself only fires during the 03:00 UTC hour (`atUtcHour: 3` in
`backup.job.ts`, once per day per process), so restarting the app outside that hour does not
produce a dump; the `pg_dump` path above is the one that needs nothing but the box.

**Restore** (setup checklist step 5, and the incident path):

```sh
# 1. Fetch the dump (any S3 client with the BACKUP_S3_* key, or the manual file above),
#    then decrypt and unpack.
BACKUP_ENCRYPTION_KEY=... openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in 2026-09-17.dump.gz.enc | gunzip -c > 2026-09-17.dump
pg_restore --list 2026-09-17.dump | head          # sanity: the table list

# 2. Into an empty database. Locally: `npm run db:up`, then create one beside `app`:
docker compose exec db createdb -U postgres app_restore
pg_restore --no-owner --no-privileges \
  --dbname "postgresql://postgres:postgres@localhost:5433/app_restore" 2026-09-17.dump
#    On the box after data loss: `docker compose stop app`, `createdb` a fresh database the
#    same way inside `dietyaar-db`, restore into it, then point DATABASE_URL at it (or rename).

# 3. Photos: copy the backup bucket's photos/{key} objects back to the photo bucket under
#    the same key (without the photos/ prefix); the Upload rows in the dump reference them.
#    With the MinIO client: mc alias set backup <BACKUP_S3_ENDPOINT> <key> <secret>;
#    mc alias set photos http://localhost:9000 dietyaar dietyaar-dev-secret;
#    mc mirror backup/dietyaar-backup/photos/ photos/dietyaar-dev/
```

Then point a local app at the restored database (`DATABASE_URL=...app_restore`, `S3_*` at the
bucket the photos went to, `S3_KEY_PREFIX` matching the keys), sign in as a test user, open the
plan, open a restored photo and confirm a day's totals. Record the time taken in checklist step 5.
_Not rehearsed yet_ (blocked on the bucket); the restore commands above are written from the job
and adapter code, not from a run.

## Postgres major version

Supabase runs Postgres 17 (17.6.1, "Measured values"). The image installs
`postgresql-client-17` from `apt.postgresql.org` (Dockerfile `ARG PG_MAJOR=17`) because
`pg_dump` must be at least the server's major version; the VPS pins the same major
(`postgres:17-alpine` in `deploy/vps/docker-compose.yml`). When either server moves to a newer
major, bump `PG_MAJOR`, rebuild, and update the "Measured values" row (a Postgres major upgrade on
the VPS is a dump-and-restore of the `db-data` volume, not an image bump).

## Weekly analytics SQL

Content-free events (`analytics_events.name` from `src/services/analytics.service.ts`) and the
AI ledger (`ai_calls`). Run against the session pooler as `postgres`:

```sql
-- Activation: accounts that both confirmed a plan and saved a meal, last 7 days.
select count(*) as activated
from (
  select "userId"
  from analytics_events
  where "createdAt" >= now() - interval '7 days' and "userId" is not null
  group by "userId"
  having bool_or(name = 'plan_confirmed') and bool_or(name = 'meal_save_succeeded')
) activated_accounts;

-- Onboarding abandonment by step.
select properties->>'step' as step, count(*) as abandoned
from analytics_events
where name = 'onboarding_abandoned' and "createdAt" >= now() - interval '7 days'
group by 1 order by 2 desc;

-- Save outcomes: success, failure and conflict counts.
select name, count(*)
from analytics_events
where name in ('meal_save_succeeded', 'meal_save_failed', 'meal_save_conflict')
  and "createdAt" >= now() - interval '7 days'
group by 1;

-- Reflection: opened, regenerated, fallback rate.
select name, count(*)
from analytics_events
where name in ('reflection_opened', 'reflection_updated', 'reflection_fallback')
  and "createdAt" >= now() - interval '7 days'
group by 1;

-- Weekly return use: distinct accounts with any event this week and last week.
select
  count(distinct "userId") filter (where "createdAt" >= now() - interval '7 days')  as this_week,
  count(distinct "userId") filter (where "createdAt" <  now() - interval '7 days')  as last_week
from analytics_events
where "createdAt" >= now() - interval '14 days';

-- AI outcome and latency by kind (ai_calls), last 7 days.
select kind, outcome, count(*) as calls,
  percentile_cont(0.5) within group (order by "durationMs") as p50_ms,
  percentile_cont(0.95) within group (order by "durationMs") as p95_ms,
  sum(coalesce("promptTokens", 0) + coalesce("completionTokens", 0)) as tokens
from ai_calls
where "createdAt" >= now() - interval '7 days'
group by 1, 2 order by 1, 2;

-- Size gauges against the § 19.10 upgrade trigger (400 MB database, 700 MB storage).
select pg_size_pretty(pg_database_size(current_database())) as database_size,
  (select pg_size_pretty(coalesce(sum(bytes), 0)) from uploads where status <> 'REMOVED') as photo_bytes;
```

## Observability

- **Logs.** pino JSON on stdout. On the VPS Docker keeps them in the container's `json-file` log
  (20 MB × 5 per service, `deploy/vps/docker-compose.yml`): `docker compose logs -f app`,
  `docker compose logs --since 24h app | grep '"level":50'` for errors. On Vercel: the project's
  Logs tab (Hobby retains one hour; nothing is shipped elsewhere). Loki only exists on Darkube.
  `task`, `event` and `durationMs` fields carry the § 16 metrics: `backup finished` /
  `backup_failed`, `prune finished`, `purge finished`.
- **No error tracker (owner decision, 2026-09-17).** Sentry is not used: no new tools. Unexpected
  errors are logged by `fromError` (`src/lib/action-result.ts`) through pino with the health-data
  redaction like every other line; `/api/health` feeds the image `HEALTHCHECK`, the `deploy-vps`
  post-deploy check and (with `/api/live`) the Darkube probes. `@/lib/logger` stays the seam if an
  error tracker is ever wanted (tech spec § 16).

## Incidents

_None yet. Add a dated entry per incident: what happened, what was done, what changed._
