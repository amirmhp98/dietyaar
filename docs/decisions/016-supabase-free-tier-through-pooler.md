# 016 — Supabase free tier for Postgres and Storage through the pooler; photos proxied through the app

**Decision.** The database is a Supabase free-tier project reached only through the Supavisor
pooler: transaction mode (`:6543`) for the application `url`, session mode (`:5432`) for
migrations and `pg_dump` (`directUrl`). The Data API is disabled; the app connects as a dedicated
role with table privileges only; `anon` and `service_role` keys never enter the app. Photos live
in one private Supabase Storage bucket accessed through its S3 API with server-side keys, and
reach the browser only through `GET /api/photos/[id]?s=<session-tag>`.

**Why.** Owner decision of September 16, 2026. The free tier covers the pilot's size. The direct
host is IPv6-only and Darkube egress is IPv4, so the pooler is the only route. Proxying photos
keeps the bucket private, makes the cache key account-bound, and means the browser never talks to
Supabase.

**Consequences.** Transaction mode forbids prepared statements, session advisory locks,
`LISTEN/NOTIFY` and temp tables; the scheduler lease (decision 010) is a plain row for this reason.
Every request crosses the Iran–EU border; the setup checklist measures the round trip and
`tech-spec.md` § 17 budgets queries per page. There are no provider backups (decision 018). If
Supabase is unreachable from the cluster, appendix A of the tech spec switches to a Darkube
PostgreSQL app with no code change. See `tech-spec.md` § 13.

**Amended 2026-09-17.** Every `DateTime` column, including the boilerplate's `users` and
`sessions`, is `timestamptz(3)`; migration `0002` performs that type change deliberately (the
CI migration-safety check allows it with this note). The container runs `TZ=UTC` and local
migrations run with `PGTZ=UTC` so the conversion is exact.
