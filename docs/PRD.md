# dietyaar — Product Reference

**Last updated:** 2026-09-15

> The single source of truth for what the product is. Agents read it before making product
> decisions and update it when a change is product-visible (new module, route, behaviour, data
> model). Keep it a reference, not a changelog. Lines marked _(boilerplate)_ describe what ships
> with the template; replace or extend them.

## What it is

<!-- One paragraph: what the product does, for whom, and why it matters. -->

## Users

- **Admin** — manages accounts (`/admin/users`) and everything a User can do. _(boilerplate role `ADMIN`)_
- **User** — signs in and uses the product. _(boilerplate role `USER`)_

## Locale

One locale profile (`src/lib/locale.ts`): English, LTR, Gregorian, Latin numerals, `UTC`, USD.

## Modules & routes

<!-- Add a line per module or route as it lands. Keep it to what exists today. -->

| Route          | Who       | What                                                                   |
| -------------- | --------- | ---------------------------------------------------------------------- |
| `/login`       | everyone  | Username/password sign-in (cookie session, throttled after 5 failures) |
| `/`            | signed-in | Home _(boilerplate placeholder)_                                       |
| `/admin/users` | Admin     | List, create, edit, activate/deactivate users, reset passwords         |
| `/components`  | signed-in | Component gallery / visual regression surface for both directions      |
| `/api/health`  | ops       | Readiness probe (database check), no auth                              |

## Behaviour worth knowing

- Deactivating a user or resetting their password ends all of their sessions immediately.
- An admin cannot change their own role or deactivate themselves.
- Sessions last `SESSION_MAX_AGE_DAYS` (default 7).

## Data model

<!-- One line per model. Point to prisma/schema.prisma for fields. -->

- `User` — `username` (unique), `passwordHash`, `fullName`, `role` (`ADMIN` \| `USER`), `isActive`, `lastLoginAt`
- `Session` — `tokenHash` (SHA-256 of the cookie token, unique), `expiresAt`, cascades on user delete

## Server actions

| Action                | Auth  | Description                          |
| --------------------- | ----- | ------------------------------------ |
| `loginAction`         | none  | Validate credentials, open a session |
| `logoutAction`        | user  | Revoke the current session           |
| `createUserAction`    | admin | Create a user                        |
| `updateUserAction`    | admin | Change name / role                   |
| `setUserActiveAction` | admin | Activate or deactivate               |
| `resetPasswordAction` | admin | Set a new password, revoke sessions  |

## Non-functional

<!-- Only what has actually been decided. -->

- Auth: httpOnly cookie sessions with hashed tokens, bcrypt (12 rounds), per-username login throttle, `SKIP_AUTH=true` for DB-less UI work (refused in production).
- Security headers: HSTS, frame-deny, nosniff, referrer policy, permissions policy.
- Deployment: Docker standalone image with health check; migrations applied on container start.
- Quality gate: lint + typecheck + unit + build + e2e + Docker build in CI on every push.

## Roadmap

<!-- Prioritised list of what is next. -->
