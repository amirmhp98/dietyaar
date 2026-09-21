# 024 — Units are measures; grams per unit is an item attribute

**Decision.** The unit table (`src/lib/units.ts`) holds measures only: `g`, `kg`, `ml`, `l`
(base), `glass` 240 ml, `cup` 200 ml, `tsp` 5 ml, `tbsp` 15 ml, `bowl` 350 ml (volume), and the
count units `piece`, `slice`, `sheet`, `skewer`, `handful`, `serving`, which carry no weight of
their own. A counted item reads "2 × سیب" or "1 slice · نان سنگک"; the size stays in the name as
the user wrote it (سیب کوچک); the grams of one unit are an attribute of the item,
`PlanItem.unitGrams` / `FoodItem.unitGrams` (`Decimal(10,2)`, null for measures). The AI fills it
for every counted item it quantifies, from a hint table the prompts still receive
(`FOOD_WEIGHT_HINTS`: medium apple ≈ 180 g, date ≈ 8 g, slice of sangak ≈ 80 g, egg ≈ 50 g,
walnut kernel ≈ 4 g, …) or its own estimate, assuming a medium size when none is stated; the user
can edit it on review ("Grams each", with a −/+ stepper on the count).

Removed unit keys: `medium_apple, small_banana, medium_banana, date, slice_sangak, slice_barbari,
slice_lavash, slice_taftoon, slice_toast, egg, medium_orange, medium_tomato, medium_cucumber,
medium_potato, walnut, almond, skewer_kabab`. Migration `20260919181822_count_units` maps stored rows (and the
`basisUnit` inside their nutrition JSON) to the measure plus the old table weight; a pending
draft that still names an old key is mapped on read (`legacyUnit()` in the item schemas'
`preprocess`).

**Why.** Owner decision of 2026-09-19 (improvement plan § 2 item 7, root cause 4): "Unit isn't
the place for fruit; today apple, tomorrow pear — what then?" A unit key per food and size made
"1 medium apple" the unit and left a pear, a plum or a slice of any other bread without a unit at
all, so their portions could never be compared. A count is a count; the food and its size belong
to the name; the weight of one is a fact about the item that the model can estimate for any food.

**Consequences.** Conversions go through the item: `toGrams(quantity, unit, { unitGrams })`.
Portion comparison (`lib/rubric/portion.ts`) compares in a common measure when every side
converts (1 slice of 80 g against 120 g), otherwise by count when both sides share the plan
item's unit (2 eggs against 3 eggs even without a weight), otherwise "Not evaluated". Scaling
(`services/food-data/scale.ts`) is linear by count for the same unit and converts through
`unitGrams` when the unit or the grams per unit change; a pair with no path still needs a new
estimate. Amounts render with plurals through `tp()` ("2 slices", "1 skewer") and precede the
name everywhere; item details show "≈ 180 g each". Prompt versions bumped: plan import 2,
plan baseline 2, meal text and photo 3. See `product-spec.md` § 6 "Household units".
