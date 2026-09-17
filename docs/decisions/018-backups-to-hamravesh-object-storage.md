# 018 — Backups go to Hamravesh Object Storage, including photos

**Decision.** A daily scheduler task runs `pg_dump --format=custom` against `directUrl`, gzips and encrypts it (`openssl enc -aes-256-cbc -pbkdf2`, key in `BACKUP_ENCRYPTION_KEY`)
and uploads it to a private Hamravesh Object Storage bucket as `db/{date}.dump.gz.enc`, after
copying every `ATTACHED` photo object not yet present to `photos/{key}`. Dumps older than
`BACKUP_RETENTION_DAYS` (default 30) are deleted, the newest always kept; photo copies are deleted
when the account is purged (amended 2026-09-17). Backups never live in the Supabase bucket. The same S3 adapter serves both targets.

**Why.** The Supabase free tier has no provider backups and pauses idle projects. Keeping the copy
in Iran on a second provider means a lost or restricted Supabase account does not lose user data,
and the restore rehearsal in the setup checklist proves the copy is usable.

**Consequences.** The image carries `postgresql-client` at the server's major version. Before any
destructive migration, `npm run db:backup` runs and the object is confirmed. Backup failure is a
metric and an alert. See `tech-spec.md` § 12 and § 13.
