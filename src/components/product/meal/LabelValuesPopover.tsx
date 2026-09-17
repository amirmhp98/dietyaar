'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { MAIN_NUTRIENTS, type Nutrition, type NutrientKey } from '@/lib/validations/nutrition';
import { NUTRIENT_UNITS } from './totals';

function parseValue(raw: string): number | null {
  const text = normalizeDigits(raw).trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * "Enter label values" (product spec § 7): the four main nutrients from the
 * package, for the amount eaten. The result is a USER_LABEL nutrition with
 * `userOverride`, which the server never scales or replaces.
 */
export function LabelValuesPopover({
  current,
  basisQuantity,
  basisUnit,
  onApply,
}: {
  current: Nutrition | null;
  basisQuantity: number | null;
  basisUnit: string | null;
  onApply: (nutrition: Nutrition) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  function reset() {
    const next: Record<string, string> = {};
    for (const key of MAIN_NUTRIENTS) {
      const v = current?.userOverride ? current.values[key] : null;
      next[key] = v === null || v === undefined ? '' : String(v);
    }
    setValues(next);
  }

  function apply() {
    onApply({
      basis: 'PER_RECORDED_PORTION',
      basisQuantity,
      basisUnit,
      values: {
        ENERGY_KCAL: parseValue(values.ENERGY_KCAL ?? ''),
        PROTEIN_G: parseValue(values.PROTEIN_G ?? ''),
        CARB_G: parseValue(values.CARB_G ?? ''),
        FAT_G: parseValue(values.FAT_G ?? ''),
        FIBER_G: null,
        SODIUM_MG: null,
      },
      source: 'USER_LABEL',
      sourceRef: null,
      isEstimate: false,
      userOverride: true,
    });
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9" data-testid="enter-label">
          {t('meal.review.enterLabel')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-sm font-medium">{t('meal.review.labelValues')}</p>
        <p className="text-xs text-muted-foreground">{t('meal.review.labelHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {MAIN_NUTRIENTS.map((key: NutrientKey) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`label-${key}`} className="text-xs">
                {t(`meal.nutrient.${key}`)} ({t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`)})
              </Label>
              <Input
                id={`label-${key}`}
                inputMode="decimal"
                dir="ltr"
                className="h-10"
                value={values[key] ?? ''}
                onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button type="button" className="h-10 w-full" onClick={apply}>
          {t('meal.review.labelApply')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
