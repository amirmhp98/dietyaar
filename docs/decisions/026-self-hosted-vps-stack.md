# 026 — Self-hosted VPS: app, Postgres and MinIO on one box

**Decision.** The first production target is a single VPS (`85.198.48.114`, Ubuntu 24.04,
2 vCPU / 4 GB / 23 GB) running `deploy/vps/docker-compose.yml`: the CI-built image, Postgres 17,
MinIO as the S3 photo bucket, and Caddy for TLS. Supabase is not used on this target; it stays the
database and bucket for Vercel (decision 021) and, when it exists, Darkube (decisions 014, 016).
CI pushes the image to `ghcr.io/amirmhp98/dietyaar:<sha>` on every push to `main` and then, from
the `deploy-vps` job, SSHes in with a dedicated deploy key, pins the tag in `/opt/dietyaar/.env`,
pulls and restarts. The Darkube deploy job is gated on the repository variable
`DARKUBE_ENABLED=true` and the Hamdocker push on its secrets, so the pipeline is green without them.

**Why.** The owner has an Iran-hosted VPS and wants a deployment that depends on no foreign SaaS:
users in Iran reach it, every request stays on the box (no ~150 ms cross-border round trip per
query, tech spec § 17), and there is no free-tier pause or egress cap. One box with three
containers is the simplest shape that meets that; the app already speaks S3 to MinIO locally and
proxies photos through `/api/photos/[id]`, so the bucket never needs to be public. GHCR is used
because it is reachable from the server and needs no extra account; MinIO images come from
`quay.io/minio/*` (MinIO no longer publishes to Docker Hub); the daemon uses `hub.hamdocker.ir` as
its Docker Hub mirror as a fallback for the rest.

**Consequences.** The database now lives on a disk the owner administers: the nightly backup to
Hamravesh Object Storage (decision 018) is the only copy off the box and must be enabled before
real users sign up (`BACKUP_ENABLED` is `false` in the server env until the bucket exists).
`next build` never runs on the server; the image is always built in CI. The in-process scheduler
runs as on Darkube (`SCHEDULER_ENABLED=true`, no `CRON_SECRET`). Upgrade the plan to more vCPU
or memory when the runbook's triggers trip; nothing in the stack assumes one node beyond what
tech spec § 12 already states.
