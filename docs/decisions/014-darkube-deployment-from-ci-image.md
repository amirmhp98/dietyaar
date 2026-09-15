# 014 — Darkube deployment from a CI-built image

**Decision.** GitHub Actions runs quality, integration and e2e jobs on every push; on `main` it
builds the Docker image, pushes it to `registry.hamdocker.ir/<org>/dietyaar:<sha>` and calls
`darkube deploy` with that tag. Darkube runs the image with `/api/health` as readiness and
`/api/live` as liveness, one replica, rolling update with `maxUnavailable: 0`. Darkube's own
Git-repo build type is not used. All base images come from `hub.hamdocker.ir/library/`.

**Why.** The boilerplate's Dockerfile and CI already do the build; CI must test before an image
exists, and Darkube's free build quota (100 hours per month, 2 GB memory) is too small for a
Next.js build. Iran-based hosting is an owner constraint; Docker Hub is reachable only through the
Hamravesh mirror.

**Consequences.** Migrations run at container start (`docker-entrypoint.sh`) with a 5 s
`lock_timeout` so a blocked migration fails fast and the old pod keeps serving. Migrations must be
backward compatible with the previous release. Secrets are Darkube secret envs. See
`tech-spec.md` § 13.
