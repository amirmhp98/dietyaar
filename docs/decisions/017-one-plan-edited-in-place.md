# 017 — One plan per user, edited in place through a draft; no versions

**Decision.** `Plan` has `userId` unique. The active plan is its slot, option, item, target, rule
and note rows. A pending import, a manual setup or an edit lives entirely in `Plan.draftJson`
until the user confirms; confirming applies the draft to the rows in one transaction. An edit
draft carries the existing row ids, so slots, options and items are updated in place, rows without
an id are inserted and missing ones deleted; position is display order only, and meal links
survive exactly (amended 2026-09-17).
There is no version history, no per-day plan assignment, no effective dates and no re-activation.

**Why.** Owner decision of September 16, 2026, superseding product spec v1.6. Plan versions
multiplied every comparison rule ("which version applied on that day?") and the UI to browse them,
for a pilot where a user has one diet from one dietitian.

**Consequences.** Editing or replacing the plan changes how every past day is compared, and the
confirm screen says so with the count of past linked meals affected. A slot that disappears sends
its meals to "Other"; a slot whose options changed keeps the link but drops the option, which
shows as "Needs review · Choose option". See `tech-spec.md` § 5 and § 21 scenarios 1–2.
