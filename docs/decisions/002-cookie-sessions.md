# 002 — Custom cookie sessions with hashed tokens instead of an auth library

**Decision.** Authentication is a username/password form, bcrypt (12 rounds), and an HTTP-only cookie
holding a random 256-bit token. The database stores only the SHA-256 of that token. Deactivating a
user or resetting a password revokes all of their sessions. Login is throttled per username.

**Why.** The target applications are internal tools with local accounts and no social login, so an
auth framework would add configuration, adapters and upgrade churn without adding a feature that is
used. The whole implementation is under 200 lines in `services/auth.service.ts` and `lib/auth.ts`,
readable in one sitting, and fully covered by unit and e2e tests. Hashing the stored token means a
leaked database cannot be replayed as cookies.

**Consequences.** Adding OAuth or SSO later means adding a second `authenticate` path, not replacing
the session model. The login throttle is in process memory; use Redis or a table when running several
replicas. `SKIP_AUTH=true` serves a mock admin for UI work and is refused in production by
`lib/env.ts`.
