# syntax=docker/dockerfile:1.7

# ─── Base ─────────────────────────────────────────────────────────────────
FROM node:lts-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
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
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ─── Builder ──────────────────────────────────────────────────────────────
FROM base AS builder

COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

COPY . .
RUN npx prisma generate

# `next build` evaluates src/lib/env.ts; a syntactically valid placeholder is enough.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
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

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

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
