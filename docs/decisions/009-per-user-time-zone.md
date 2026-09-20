# 009 — Per-user time zone and week start; the locale profile's zone is never read

**Superseded by [022](022-fixed-time-zone.md):** every account counts its days in `Asia/Dubai`;
the lint rule and the pure `lib/time` functions described here stay.

**Decision.** `Profile.timeZone` (IANA) decides what "today" means for a user, and every
`DayRecord` stores the zone in effect when it was created. `Profile.weekStart` decides the week.
Nothing outside `lib/locale.ts` and `lib/format.ts` may read `locale.timeZone`; a lint rule
enforces it. Day boundaries, the late-night window and time bands are pure functions in
`lib/time/` that take the zone as an argument.

**Why.** The boilerplate's one-profile-per-deployment rule (decision 003) fixes a single zone for
the whole app. Dietyaar's users travel and live in different zones, and a meal at 23:30 must land
on the right day for the person who ate it, not for the server. Storing the zone on the day keeps
history stable when the profile changes.

**Consequences.** Every date computation takes `now` and a zone explicitly, which makes the
rubric testable without a clock. Historical days keep their own zone. The profile's `en` locale
still drives language, calendar, numerals and formatting. See `tech-spec.md` § 9.
