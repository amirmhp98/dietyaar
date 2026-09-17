# 008 — Self-service sign-up with username and password only; no recovery

**Decision.** Users create their own account at `/signup` with a username (3–30 chars,
`[A-Za-z0-9_]`, unique case-insensitively via `citext`) and a password (8–64 characters, at most
72 UTF-8 bytes, not in the bundled top-10k common-password list). There is no email column, no
recovery form, no reset token and no outbound email of any kind. A lost password loses the account.
The boilerplate Users module stays as the operator's tool; it does not gate sign-up.

**Why.** Owner decision of September 16, 2026: the first release is unpaid and run by one person,
and an email provider, verified addresses and a reset flow are cost and attack surface with no
product value for the pilot. Saying so on the sign-up form and in Settings is honest and cheap.

**Consequences.** The boilerplate rule "Users: no self-registration" is overridden. Sign-up is
rate-limited per IP (10 per hour, tunable). The Users module keeps `ADMIN` for the operator and
never shows health data. Adding recovery later means adding a contact channel first; the account
model does not need to change for that. See `tech-spec.md` § 8.

**Amended 2026-09-17.** Sign-up collects no name, so `User.fullName` becomes nullable; the
greeting reads `Profile.displayName`, then the username. The admin Users module shows
`fullName ?? username`. Admin and seed accounts are created with `onboardingStep = DONE`.
