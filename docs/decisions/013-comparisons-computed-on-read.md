# 013 — Comparisons are computed on read; no cache, no stored score

**Decision.** A day's comparison (slot match, portion, timing, order, nutrition subtotals, score,
coverage) is computed when the day is viewed, from the meals, skipped slots, completeness flag,
the current plan, `now` and `RUBRIC_VERSION`, by pure functions in `lib/rubric/` and `lib/time/`.
Nothing derived is stored. The view model carries the rubric version and the contributing meal
ids and revisions for traceability.

**Why.** Owner decision to keep features minimal: a stored score needs invalidation on every meal
edit, plan edit, midnight and rubric change, and each of those paths is a bug waiting to happen.
At fewer than twenty meals a day the computation is milliseconds, and the cross-border round trip
to Supabase dominates anyway.

**Consequences.** A rubric change applies to all history at once; a plan edit changes past
comparisons by design (decision 017). History computes seven days on read with two queries.
`lib/rubric/**` and `lib/time/**` import nothing from services or Prisma and require 95 percent
statement coverage. See `tech-spec.md` § 6.
