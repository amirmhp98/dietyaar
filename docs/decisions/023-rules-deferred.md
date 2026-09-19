# 023 — Rules are deferred; plan instructions are kept as notes

**Decision.** V1 evaluates no plan rules. Every instruction that is not a meal, a quantity, a
target or a schedule ("ماهی دو بار در هفته", "روزهای تمرین …", "قند ممنوع") is a `PlanNote`:
kept verbatim, shown once on review screen 8c ("Review: notes") and under "Notes from your plan"
on My plan, never compared, never scored. The `PlanRule` model, its enums, `FoodItem.ruleGroups`,
`lib/rubric/rules.ts`, the rule progress read models, the weekly-rules block on History and the
Track it / Keep as a note / Don't compare choice are removed, not hidden. The import prompt no
longer extracts rules; a former rule is a note with reason `OTHER`. Manual setup has no rules
step. Migration `20260919180546_defer_rules` copies each existing rule's text into `plan_notes`
before dropping the table.

**Why.** Owner decision of September 19, 2026 (improvement plan C2). Rule tracking was never
designed as a feature: the rule kinds, the counting definitions, the three-way choice per rule
and the period progress were built from the spec's examples, and the reviews found nobody could
say what a "met" weekly variety rule should mean for a real plan. Shipping an unevaluated,
verbatim note is honest; shipping a half-designed tracker is not. Rules return later with their
own spec.

**Consequences.** Product spec § 6, § 8 and § 10 read "Rules are not evaluated in V1; plan
instructions are kept as notes (decision 023)" where they described rule handling. The day score
is unchanged (rules never entered it); the seven-day pattern sentence is unchanged (it never used
rules). A meal's timing window comes only from the slot's own times. Old `Plan.draftJson` values
may still carry a `rules` array; the draft parser strips unknown keys, so they load as before.
