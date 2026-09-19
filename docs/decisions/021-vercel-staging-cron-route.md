# 021 — Vercel as a staging target; platform cron drives the jobs

**Decision.** The app also runs on Vercel (project `dietyaar`, team `amirmhps-projects`, region
`fra1`, Hobby plan) as a staging and demo environment, built from GitHub `main` through Vercel's
Git integration. There the in-process scheduler is off (`SCHEDULER_ENABLED=false`) and a Vercel
cron calls `GET /api/cron/all` once a day with `Authorization: Bearer $CRON_SECRET`; the route
runs every registered task through `runJobsNow()`, the same entry point `after()` uses from the
import action. Backups are off there (`BACKUP_ENABLED=false`): the job shells out to `pg_dump` and
`openssl`, which a Vercel function does not have. The build is `prisma generate && prisma migrate
deploy && next build` (`vercel-build` script), so migrations run at build time against
`DIRECT_DATABASE_URL` instead of at container start.

**Why.** Vercel is the fastest way to a public URL for review, and its Fluid Compute keeps
`after()` alive long enough for the plan import. A serverless function has no long-lived process
for `setInterval`, and the Hobby plan allows at most two cron jobs, each once a day, so one route
that runs everything is the shape that fits. Vercel geo-blocks Iranian IPs, so it cannot be the
environment users in Iran hit: production stays on Hamravesh (decision 014), and the VPS target is
the third option.

**Consequences.** The hourly cadences in tech spec § 12 become daily on Vercel; staged uploads and
deleted accounts wait up to a day longer to be purged, which is acceptable for staging. Plan
imports still start immediately via `after()`; the daily run only recovers stuck ones. Previews
share the production Supabase database, so the backward-compatible migration rule applies to every
pushed branch. `CRON_SECRET` unset means the route answers 404 (Darkube and the VPS keep the
scheduler and never set it). Photos land under `S3_KEY_PREFIX=vercel/` so the environments do not
mix objects.
