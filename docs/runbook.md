# Runbook

Operating notes for the one person who runs Dietyaar. The one-time setup checklist below comes
from `tech-spec.md` § 13; record each result here as it is done. Everything after the checklist
grows as incidents and routines happen.

## One-time setup checklist

Results are blank until the step is done. Do not build product code that touches data from the
cluster before step 2 is recorded (tech spec § 1, constraints).

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Result | Date |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 1   | Create the Supabase project (region per § 19.1, default `eu-central-1`); disable the Data API; create role `dietyaar_app` with table privileges only; create bucket `dietyaar` (private) and S3 keys; enable `citext` and `pgcrypto`. Verify an anonymous REST call to the project is rejected. Create the Hamravesh backup bucket `dietyaar-backup` and key, the Darkube namespace, the Sentry project and the web app.                                                                                                     |        |      |
| 2   | From the web app's terminal on Darkube: `psql "$DIRECT_DATABASE_URL" -c 'select 1'` and the same through `$DATABASE_URL`, round-trip time over 20 runs (record p50/p95 as `R`); S3 `ListObjects` against both buckets; `curl https://api.deepseek.com/models` with the key; `curl` the USDA search endpoint; confirm the DeepSeek request field that disables thinking; a request that sleeps 50 s through the public domain to measure the ingress timeout. If Supabase is unreachable, stop and apply § 19.2 / appendix A. |        |      |
| 3   | Upload a 10 MB file to `/api/uploads` through the public domain; record the ingress body limit.                                                                                                                                                                                                                                                                                                                                                                                                                              |        |      |
| 4   | Run `npm run ai:eval` on the deployment account; archive the report; compare with § 19.4 thresholds.                                                                                                                                                                                                                                                                                                                                                                                                                         |        |      |
| 5   | Run `npm run db:backup`; restore the dump into the second free Supabase project; point a local app at it; sign in as a test user, open the plan, open a photo restored from the backup bucket, confirm a day's totals match. Record how long it took.                                                                                                                                                                                                                                                                        |        |      |
| 6   | Confirm `/api/health` and `/api/live` return 200 and Loki shows the startup line.                                                                                                                                                                                                                                                                                                                                                                                                                                            |        |      |

### Measured values

Development does not wait for these: the default in the last column applies until the step is done.

| Value                                   | Result | Where it is used                                            | Default until measured                                  |
| --------------------------------------- | ------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| Cross-border round trip `R` (p50 / p95) |        | § 17 query budgets; review gate if `R` > 150 ms             | assume 150 ms; budgets as written                       |
| Ingress request timeout                 |        | § 20: if below 45 s, meal analysis moves to the job pattern | assume ≥ 60 s; meal analysis stays a server action      |
| Ingress body limit                      |        | § 11                                                        | assume ≥ 10 MB; device downscaling keeps uploads < 1 MB |
| DeepSeek field that disables thinking   |        | `services/ai/deepseek.ts`                                   | `thinking: { type: 'disabled' }`                        |
| Supabase Postgres major version         |        | `Dockerfile` (`postgresql-client` version)                  | 17                                                      |

## Environments

| Name         | Where                  | Database                                  | Storage                                    | Notes                                  |
| ------------ | ---------------------- | ----------------------------------------- | ------------------------------------------ | -------------------------------------- |
| Local        | `npm run dev`          | docker-compose Postgres (`npm run db:up`) | —                                          | `SKIP_AUTH=true` for UI-only work      |
| Production   | Darkube app `dietyaar` | Supabase project (primary)                | Supabase bucket `dietyaar`, prefix `prod/` | Backups to Hamravesh `dietyaar-backup` |
| Restore test | local app              | second Supabase project                   | —                                          | Used only for step 5 rehearsals        |

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

## Incidents

_None yet. Add a dated entry per incident: what happened, what was done, what changed._
