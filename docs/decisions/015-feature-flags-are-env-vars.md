# 015 — Feature flags are environment variables

**Decision.** Product switches (`PHOTO_LOGGING_ENABLED`, `USDA_LOOKUP_ENABLED`,
`SCHEDULER_ENABLED`, `BACKUP_ENABLED`) and tunables (caps, budgets, limits) are environment
variables validated in `src/lib/env.ts`, with defaults in `.env.example`. There is no flags table
and no per-user targeting.

**Why.** One deployment, one operator. A Darkube env change and restart flips a flag without a
deploy; a table would need an admin UI, caching and a migration for no benefit at this scale.

**Consequences.** Flags are global. A per-user rollout would need a table and is a new decision.
Every flag is documented in `.env.example` and `tech-spec.md` § 14.
