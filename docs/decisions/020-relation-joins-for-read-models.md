# 020 — Nested reads use Prisma `relationJoins`

**Decision.** The Prisma client runs with the `relationJoins` preview feature, so every `include`
tree is fetched in one SQL statement with lateral joins instead of one statement per relation
level. This is what tech spec § 17's query budget assumes: Today is three logical reads (day with
meals and items, plan slots for the weekday, morning message) and stays three round trips.

**Why.** Task 11.6 measured the read models in development on 2026-09-18 (`docs/runbook.md`,
"Query counts"): without the feature Today issued 13 statements and History 13, most of them
sequential, because the plan tree is four levels deep (plan → slots → options → items) and the
day tree three (day → meals → items → uploads). Against the measured cross-border round trip of
113–257 ms that is 1–3 s per page; with the feature Today is 3 statements, History 3, a meal
list 1. Unit, integration and e2e suites pass unchanged with the feature on.

**Consequences.** `relationJoins` is a preview flag in Prisma 6; it is listed in
`prisma/schema.prisma`'s generator block and must survive Prisma upgrades (Renovate bumps are
checked by CI's integration job). If a future Prisma release changes the default, the
`relationLoadStrategy: 'join'` option per query is the fallback. Turning the flag off changes no
behaviour, only the number of round trips.
