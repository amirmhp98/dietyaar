# Decision records

Short notes on the choices that shape this codebase, so adopters and agents do not re-litigate
them. 001–007 come from the boilerplate; 008 onwards are Dietyaar's (see `tech-spec.md` § 18). One file per decision, a paragraph or two each. Add a new one when you change a rule.

| #                                                 | Decision                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [001](001-services-layer.md)                      | Business logic lives in a framework-free services layer           |
| [002](002-cookie-sessions.md)                     | Custom cookie sessions with hashed tokens instead of an auth lib  |
| [003](003-locale-profile.md)                      | One locale profile per deployment, strings through `t()`          |
| [004](004-local-ui-kit.md)                        | Locally owned shadcn components behind one barrel                 |
| [005](005-lint-enforced-layering.md)              | Architecture rules are ESLint rules, not prose                    |
| [006](006-agent-config-in-repo.md)                | Agent configuration and skills are committed                      |
| [007](007-first-session-defines-the-product.md)   | The first agent session defines the product before building       |
| [008](008-self-service-signup-no-recovery.md)     | Self-service sign-up with username and password only; no recovery |
| [009](009-per-user-time-zone.md)                  | Per-user time zone and week start (superseded by 022)             |
| [010](010-in-process-scheduler-lease.md)          | In-process scheduler under a heartbeat lease row                  |
| [011](011-photos-converted-on-device.md)          | Photos converted on the device; server accepts JPEG, PNG, WebP    |
| [012](012-ai-adapters-persist-nothing.md)         | AI adapters return validated data and persist nothing             |
| [013](013-comparisons-computed-on-read.md)        | Comparisons are computed on read; no cache, no stored score       |
| [014](014-darkube-deployment-from-ci-image.md)    | Darkube deployment from a CI-built image                          |
| [015](015-feature-flags-are-env-vars.md)          | Feature flags are environment variables                           |
| [016](016-supabase-free-tier-through-pooler.md)   | Supabase free tier through the pooler; photos proxied by the app  |
| [017](017-one-plan-edited-in-place.md)            | One plan per user, edited in place through a draft; no versions   |
| [018](018-backups-to-hamravesh-object-storage.md) | Backups go to Hamravesh Object Storage, including photos          |
| [019](019-design-tokens-from-design-md.md)        | Visual language: design.md tokens on the local shadcn kit         |
| [020](020-relation-joins-for-read-models.md)      | Nested reads use Prisma `relationJoins` (one statement per tree)  |
| [021](021-vercel-staging-cron-route.md)           | Vercel is a staging target; a platform cron drives the jobs       |
| [022](022-fixed-time-zone.md)                     | One app time zone (Asia/Dubai); the user never sees a zone        |
| [023](023-rules-deferred.md)                      | Rules are deferred; plan instructions are kept as notes           |
| [024](024-count-units.md)                         | Units are measures; grams per unit is an item attribute           |
| [025](025-consumer-visual-language.md)            | Consumer visual language on the Supabase palette (amends 019)     |
| [026](026-self-hosted-vps-stack.md)               | Self-hosted VPS: app, Postgres and MinIO on one box               |
