# 010 — In-process scheduler under a heartbeat lease row

**Decision.** Background work (plan import jobs, upload and draft cleanup, account purge,
operational pruning, backups) runs inside the web process, started from `src/instrumentation.ts`
when `SCHEDULER_ENABLED=true`. A `JobLock` row named `scheduler` is renewed every 20 s with a 60 s
lease; only the holder schedules tasks. Jobs are rows in Postgres claimed with a conditional
`UPDATE … RETURNING`, heartbeat while running, and finalise with a conditional update so an
obsolete attempt cannot commit. There is no queue and no external cron.

**Why.** Darkube has no CronJob and the boilerplate ships no background mechanism ("where it would
go: a route handler called by an external scheduler"). One replica, one process and a lease row
cover the first release with zero extra infrastructure, work through the transaction pooler, and
survive rolling updates.

**Consequences.** The login throttle and the rate limits stay in-process and reset on deploy,
which is acceptable at one replica. At more than one replica those move to a `RateLimitBucket`
table; the scheduler itself needs no change. Tasks check a stop flag between units of work and
never run longer than 10 minutes. See `tech-spec.md` § 12.
