# 022 — One app time zone (Asia/Dubai); the user never sees a zone

**Decision.** Every account counts its days in `Asia/Dubai`: `APP_TIME_ZONE` in
`src/lib/time/zone.ts` is the one value the app passes to the `lib/time` functions, which stay
pure and zone-parameterised. There is no time-zone question in onboarding, no Settings field and no
"your device is in another zone" hint; `Profile.timeZone` and the device-zone columns are gone.
`DayRecord.timeZone` stays: a day records the zone it was computed in, the export includes it, and
a stored day is always read in its own zone. `Profile.weekStart` is unchanged. Nothing outside
`lib/locale.ts` and `lib/format.ts` may read `locale.timeZone`; the lint rule from decision 009
stays, now pointing here. Supersedes decision 009.

**Why.** The first users all live in one zone, and the zone step was the one onboarding screen
that asked about something nobody had thought about. Per-user zones bought travel correctness at
the price of a question, a preference, a hint on Today and a default of UTC for anyone who had not
answered yet; the owner chose the simpler product. Asia/Dubai has no daylight saving, so day
boundaries and the 00:00–04:00 window never shift.

**Consequences.** Onboarding is five questions and ten steps instead of eleven. A user who logs a
meal while abroad sees it land on the Dubai date; the date can still be corrected by hand. The
migration drops the profile columns, removes `TIME_ZONE` from `OnboardingStep` (a user parked
there resumes at the display name), and leaves day rows untouched. Reintroducing per-user zones
later means adding the column back and replacing the constant at its call sites; the pure
functions need no change. See `tech-spec.md` § 9.
