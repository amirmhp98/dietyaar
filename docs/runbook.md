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
| 2   | From the web app's terminal on Darkube: `psql "$DIRECT_DATABASE_URL" -c 'select 1'` and the same through `$DATABASE_URL`, round-trip time over 20 runs (record p50/p95 as `R`); S3 `ListObjects` against both buckets; `curl https://api.deepseek.com/models` with the key; `curl` the USDA search endpoint; confirm the DeepSeek request field that disables thinking; a request that sleeps 50 s through the public domain to measure the ingress timeout. If Supabase is unreachable, stop and apply § 19.2 / appendix A. |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            |
| 3   | Upload a 10 MB file to `/api/uploads` through the public domain; record the ingress body limit.                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            |
| 4   | Run `npm run ai:eval` on the deployment account; archive the report; compare with § 19.4 thresholds.                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            |
| 5   | Run `npm run db:backup`; restore the dump into the second free Supabase project; point a local app at it; sign in as a test user, open the plan, open a photo restored from the backup bucket, confirm a day's totals match. Record how long it took.                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            |
| 6   | Confirm `/api/health` and `/api/live` return 200 and Loki shows the startup line.                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            |

### Measured values

Development does not wait for these: the default in the last column applies until the step is done.

| Value                                   | Result                                                               | Where it is used                                            | Default until measured                                  |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Cross-border round trip `R` (p50 / p95) | not yet (Darkube). Dev machine via VPN, session pooler: 113 / 257 ms | § 17 query budgets; review gate if `R` > 150 ms             | assume 150 ms; budgets as written                       |
| Ingress request timeout                 |                                                                      | § 20: if below 45 s, meal analysis moves to the job pattern | assume ≥ 60 s; meal analysis stays a server action      |
| Ingress body limit                      |                                                                      | § 11                                                        | assume ≥ 10 MB; device downscaling keeps uploads < 1 MB |
| DeepSeek field that disables thinking   |                                                                      | `services/ai/deepseek.ts`                                   | `thinking: { type: 'disabled' }`                        |
| Supabase Postgres major version         | 17 (17.6.1)                                                          | `Dockerfile` (`postgresql-client` version)                  | 17                                                      |

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

## Environments

| Name         | Where                  | Database                                  | Storage                                    | Notes                                  |
| ------------ | ---------------------- | ----------------------------------------- | ------------------------------------------ | -------------------------------------- |
| Local        | `npm run dev`          | docker-compose Postgres (`npm run db:up`) | —                                          | `SKIP_AUTH=true` for UI-only work      |
| Production   | Darkube app `dietyaar` | Supabase project `uhevhxxyjhgldbmxyfmg`   | Supabase bucket `dietyaar`, prefix `prod/` | Backups to Hamravesh `dietyaar-backup` |
| Restore test | local app              | second Supabase project                   | —                                          | Used only for step 5 rehearsals        |

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

- **Deploy.** Push to `main`; CI builds and pushes the image and calls `darkube deploy`. Watch the
  rollout; readiness is `/api/health`. Migrations run at container start with `lock_timeout = 5s`.
- **Before a destructive migration.** `npm run db:backup`, confirm the object exists, then deploy.
- **Flip a flag.** Change the Darkube env (`PHOTO_LOGGING_ENABLED`, `USDA_LOOKUP_ENABLED`, …) and
  restart; no deploy.
- **Weekly.** Run the analytics SQL (§ 16) and check the size gauges against the § 19.10 upgrade
  trigger: database over 400 MB, storage over 700 MB, egress over 4 GB per month.
- **If the Supabase project was paused** (replicas were zero for 7 days): unpause it in the
  dashboard, then restart the app.

## Deploy and rollback

CI (`.github/workflows/ci.yml`) runs `quality`, `integration`, `e2e` (desktop and mobile
Playwright projects against the stub AI server) and `migrations` (`scripts/check-migrations.mjs`);
`docker` builds the image, smoke-tests `/api/health`, `/api/live` and `pg_dump --version`, and on a
push to `main` pushes `registry.hamdocker.ir/<org>/dietyaar:<short sha>`; `deploy` then runs
`darkube deploy` inside the `hamravesh.hamdocker.ir/public/darkube-cli:v1.1` container.

GitHub secrets: `HAMDOCKER_ORG`, `HAMDOCKER_USERNAME`, `HAMDOCKER_PASSWORD` (container registry
page of the Hamravesh console), `DARKUBE_DEPLOY_TOKEN`, `DARKUBE_APP_ID` (app profile page).

**Rollback.** Every release image stays in the registry under its short SHA. To go back:

```sh
docker run --rm hamravesh.hamdocker.ir/public/darkube-cli:v1.1 \
  darkube deploy --ref main --token "$DARKUBE_DEPLOY_TOKEN" --app-id "$DARKUBE_APP_ID" \
  --image-tag <previous short sha> --job-id manual-rollback --stateless-app true
```

Safe because migrations are backward compatible with the previous release (tech spec § 13: add
nullable, backfill, tighten later) and the migration gate refuses `DROP` / `ALTER … TYPE` without
a decision record. The rolled-back pod does not undo the newer migration; if that migration must
go, restore from the last dump instead (below). _Verify once the first deploy has run:_ the exact
`darkube deploy` flags and the `--stateless-app` value against the Darkube console; the same
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
`dumpBytes` and `durationMs`; failure logs `backup_failed` (alert on it in Grafana, § 16).

**Encryption key.** `BACKUP_ENCRYPTION_KEY` is a long random passphrase generated once
(`openssl rand -base64 48`), stored as a Darkube secret env and in the owner's password manager.
Losing it makes every dump unreadable; rotating it does not re-encrypt old dumps, so keep the
previous key until those have expired.

**Manual backup** (before a destructive migration, or for the rehearsal):

```sh
DOTENV_CONFIG_PATH=.env.production.local npm run db:backup   # needs pg_dump 17, gzip, openssl on PATH
```

Prints the result JSON (`dumpKey`, `dumpBytes`, `photosCopied`, `dumpsDeleted`) and exits 1 on
failure. The same command works from the Darkube web terminal with the app's env already set.

**Restore** (setup checklist step 5, and the incident path):

```sh
# 1. Fetch the dump (any S3 client with the BACKUP_S3_* key), then decrypt and unpack.
BACKUP_ENCRYPTION_KEY=... openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in 2026-09-17.dump.gz.enc | gunzip -c > 2026-09-17.dump
pg_restore --list 2026-09-17.dump | head          # sanity: the table list

# 2. Into an empty database (the second Supabase project, or local Postgres):
pg_restore --no-owner --no-privileges --dbname "$TARGET_DIRECT_DATABASE_URL" 2026-09-17.dump

# 3. Photos: copy the backup bucket's photos/{key} objects back to the photo bucket under
#    the same key (without the photos/ prefix); the Upload rows in the dump reference them.
```

Then point a local app at the restored database, sign in as a test user, open the plan, open a
restored photo and confirm a day's totals. Record the time taken in checklist step 5.

## Postgres major version

Supabase runs Postgres 17 (17.6.1, "Measured values"). The image installs
`postgresql-client-17` from `apt.postgresql.org` (Dockerfile `ARG PG_MAJOR=17`) because
`pg_dump` must be at least the server's major version. When Supabase upgrades the project, bump
`PG_MAJOR`, rebuild, and update the "Measured values" row.

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

- **Logs.** pino JSON on stdout → Loki. `task`, `event` and `durationMs` fields carry the § 16
  metrics: `backup finished` / `backup_failed`, `prune finished`, `purge finished`.
- **No error tracker (owner decision, 2026-09-17).** Sentry is not used: no new tools. Unexpected
  errors are logged by `fromError` (`src/lib/action-result.ts`) through pino with the health-data
  redaction and reach Loki like every other line; `/api/live` and `/api/health` feed the Darkube
  probes. `@/lib/logger` stays the seam if an error tracker is ever wanted (tech spec § 16).

## Incidents

_None yet. Add a dated entry per incident: what happened, what was done, what changed._
