-- Decision 024: units are measures. A count unit (piece, slice, sheet, skewer,
-- handful, serving) carries no weight of its own; the grams of one unit live on
-- the item as `unitGrams`. The old food-and-size unit keys become a measure plus
-- that weight; names stay exactly as written.

-- AlterTable
ALTER TABLE "food_items" ADD COLUMN     "unitGrams" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "plan_items" ADD COLUMN     "unitGrams" DECIMAL(10,2);

-- Data: old unit keys → measure + grams per unit, on plan items and food items.
-- The nutrition JSON of those rows names the old key in `basisUnit`; it follows
-- the same mapping so portion scaling keeps working.
UPDATE "plan_items" AS pi
SET "unit"      = m.new_unit,
    "unitGrams" = m.grams,
    "nutrition" = CASE
      WHEN pi."nutrition" IS NOT NULL AND pi."nutrition" ->> 'basisUnit' = m.old_unit
        THEN jsonb_set(pi."nutrition", '{basisUnit}', to_jsonb(m.new_unit))
      ELSE pi."nutrition"
    END
FROM (VALUES
  ('medium_apple',    'piece',  180.00),
  ('small_banana',    'piece',  100.00),
  ('medium_banana',   'piece',  120.00),
  ('date',            'piece',    8.00),
  ('egg',             'piece',   50.00),
  ('medium_orange',   'piece',  150.00),
  ('medium_tomato',   'piece',  120.00),
  ('medium_cucumber', 'piece',  100.00),
  ('medium_potato',   'piece',  150.00),
  ('walnut',          'piece',    4.00),
  ('almond',          'piece',    1.20),
  ('slice_sangak',    'slice',   80.00),
  ('slice_barbari',   'slice',   70.00),
  ('slice_toast',     'slice',   30.00),
  ('slice_lavash',    'sheet',   30.00),
  ('slice_taftoon',   'sheet',   60.00),
  ('skewer_kabab',    'skewer', 120.00),
  ('handful',         'handful', 30.00)
) AS m(old_unit, new_unit, grams)
WHERE pi."unit" = m.old_unit;

UPDATE "food_items" AS fi
SET "unit"      = m.new_unit,
    "unitGrams" = m.grams,
    "nutrition" = CASE
      WHEN fi."nutrition" IS NOT NULL AND fi."nutrition" ->> 'basisUnit' = m.old_unit
        THEN jsonb_set(fi."nutrition", '{basisUnit}', to_jsonb(m.new_unit))
      ELSE fi."nutrition"
    END
FROM (VALUES
  ('medium_apple',    'piece',  180.00),
  ('small_banana',    'piece',  100.00),
  ('medium_banana',   'piece',  120.00),
  ('date',            'piece',    8.00),
  ('egg',             'piece',   50.00),
  ('medium_orange',   'piece',  150.00),
  ('medium_tomato',   'piece',  120.00),
  ('medium_cucumber', 'piece',  100.00),
  ('medium_potato',   'piece',  150.00),
  ('walnut',          'piece',    4.00),
  ('almond',          'piece',    1.20),
  ('slice_sangak',    'slice',   80.00),
  ('slice_barbari',   'slice',   70.00),
  ('slice_toast',     'slice',   30.00),
  ('slice_lavash',    'sheet',   30.00),
  ('slice_taftoon',   'sheet',   60.00),
  ('skewer_kabab',    'skewer', 120.00),
  ('handful',         'handful', 30.00)
) AS m(old_unit, new_unit, grams)
WHERE fi."unit" = m.old_unit;
