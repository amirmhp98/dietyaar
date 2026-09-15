# 018 — Backups go to Hamravesh Object Storage, including photos

**Decision.** A daily scheduler task runs `pg_dump --format=custom` against `directUrl`, gzips it
and uploads it to a private Hamravesh Object Storage bucket as `db/{date}.dump.gz`, then copies
every `ATTACHED` photo object not yet present to `photos/{key}`. The newest
`BACKUP_RETENTION_COUNT` dumps (default 14) are kept; photos are kept until the account is
deleted. Backups never live in the Supabase bucket. The same S3 adapter serves both targets.

**Why.** The Supabase free tier has no provider backups and pauses idle projects. Keeping the copy
in Iran on a second provider means a lost or restricted Supabase account does not lose user data,
and the restore rehearsal in the setup checklist proves the copy is usable.

**Consequences.** The image carries `postgresql-client` at the server's major version. Before any
destructive migration, `npm run db:backup` runs and the object is confirmed. Backup failure is a
metric and an alert. See `tech-spec.md` § 12 and § 13.
