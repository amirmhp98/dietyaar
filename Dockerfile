# syntax=docker/dockerfile:1.7

# Darkube pulls only through the Hamravesh mirror (decision 014). Override on a
# machine that cannot reach it: --build-arg NODE_IMAGE=node:lts-slim
ARG NODE_IMAGE=hub.hamdocker.ir/library/node:lts-slim

# ─── Base ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
WORKDIR /app
# Every date the app derives comes from the user's zone; the process clock is UTC.
ENV TZ=UTC \
    NEXT_TELEMETRY_DISABLED=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    # Prisma engine mirror for networks where the default CDN is blocked.
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

# deb.debian.org can be unreachable from some networks (e.g. Iranian IaaS).
# Uncomment one mirror if apt-get fails:
#   RUN sed -i 's|deb.debian.org|mirror.arvancloud.ir|g' /etc/apt/sources.list.d/debian.sources
#   (alternatives: mirror.iranserver.com, repo.iut.ac.ir, mirror.pars.host)
RUN apt-get -o Acquire::Check-Valid-Until=false update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ─── Builder ──────────────────────────────────────────────────────────────
FROM base AS builder

COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

COPY . .
RUN npx prisma generate

# `next build` evaluates src/lib/env.ts; a syntactically valid placeholder is enough.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    APP_URL="http://localhost:3000"
RUN npm run build

# Prisma CLI for `migrate deploy` at container start, installed on its own so
# npm resolves its full dependency closure (the standalone output only traces
# what the app imports at runtime).
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefix /opt/prisma-cli --no-audit --no-fund --no-package-lock --omit=dev \
      "prisma@$(node -p "require('prisma/package.json').version")"

# ─── Runner ───────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `pg_dump` for the nightly backup (tech spec § 12/§ 13, decision 018) at the
# Supabase server's major version (runbook "Measured values": 17). Debian's own
# package is older, so it comes from the PostgreSQL apt repository. gzip is in
# the base image; openssl came with the base stage.
# apt.postgresql.org sits behind Fastly and is unreachable from some build
# networks (Darkube's builders, 2026-09-21). There the step falls back to
# Debian's postgresql-client (15 on bookworm) with a warning: `psql` works, but
# `pg_dump` refuses a newer server, so backups need an image built where the
# repository is reachable (GitHub CI builds the VPS image); on Darkube
# BACKUP_ENABLED=false and pg_dump is never called.
ARG PG_MAJOR=17
RUN apt-get -o Acquire::Check-Valid-Until=false update -y \
    && apt-get install -y --no-install-recommends curl gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && (curl -fsSL --max-time 30 https://www.postgresql.org/media/keys/ACCC4CF8.asc \
          -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        || echo "WARN: could not fetch the PostgreSQL apt key" >&2) \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get -o Acquire::Retries=0 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 update -y \
    && ( apt-get install -y --no-install-recommends "postgresql-client-${PG_MAJOR}" \
         || { echo "WARN: postgresql-client-${PG_MAJOR} unavailable (apt.postgresql.org unreachable); installing Debian's postgresql-client instead. pg_dump will refuse a newer server, so backups need a build with the PostgreSQL repository reachable." >&2; \
              rm -f /etc/apt/sources.list.d/pgdg.list \
              && apt-get update -y \
              && apt-get install -y --no-install-recommends postgresql-client; } ) \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# sharp is in `serverExternalPackages`, so the standalone tracer only copies
# what it can see; copy the package, its prebuilt binaries (`@img/*`) and its
# two runtime dependencies explicitly so photo decoding never depends on tracing.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/detect-libc ./node_modules/detect-libc

# Schema + migrations + the standalone Prisma CLI.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /opt/prisma-cli /opt/prisma-cli

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./docker-entrypoint.sh"]
