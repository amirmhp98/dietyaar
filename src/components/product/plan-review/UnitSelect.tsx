'use client';

import { useState } from 'react';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { UNITS, isCountUnit, unitLabel } from '@/lib/units';
import { numberText, parseNumber } from './helpers';

const NONE = '__none';
const OTHER = '__other';

/**
 * Unit picker for plan items: the measures of the unit table (product spec
 * § 6, decision 024) plus "no unit" and a free-text unit kept as written.
 * A count unit ("piece", "slice") reveals the grams-each field when
 * `onUnitGramsChange` is given, since the weight of one belongs to the item.
 */
export function UnitSelect({
  value,
  onChange,
  unitGrams = null,
  onUnitGramsChange,
  id,
  ariaLabel,
}: {
  value: string | null;
  onChange: (unit: string | null) => void;
  unitGrams?: number | null;
  onUnitGramsChange?: (unitGrams: number | null) => void;
  id?: string;
  ariaLabel: string;
}) {
  const known = value === null || UNITS.some((u) => u.key === value);
  const [other, setOther] = useState(!known);
  const selected = other ? OTHER : value === null ? NONE : value;
  return (
    <div className="space-y-2">
      <Select
        value={selected}
        onValueChange={(next) => {
          if (next === OTHER) {
            setOther(true);
            return;
          }
          setOther(false);
          onChange(next === NONE ? null : next);
        }}
      >
        <SelectTrigger id={id} className="h-11" aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('plan.unit.none')}</SelectItem>
          {UNITS.map((unit) => (
            <SelectItem key={unit.key} value={unit.key}>
              {unitLabel(unit.key)}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>{t('plan.unit.other')}</SelectItem>
        </SelectContent>
      </Select>
      {other ? (
        <Input
          dir="auto"
          className="h-11"
          aria-label={t('plan.unit.otherLabel')}
          placeholder={t('plan.unit.otherLabel')}
          value={known ? '' : (value ?? '')}
          maxLength={40}
          onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
        />
      ) : null}
      {onUnitGramsChange && isCountUnit(value) ? (
        <GramsEachInput value={unitGrams} onChange={onUnitGramsChange} />
      ) : null}
    </div>
  );
}

/** The grams of one piece / slice / …: a small numeric field, empty when unknown. */
export function GramsEachInput({
  value,
  onChange,
  id,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(numberText(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (parseNumber(raw) !== value) setRaw(numberText(value));
  }
  return (
    <div className={className}>
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        className="h-11"
        aria-label={t('unit.gramsEach.label')}
        placeholder={t('unit.gramsEach.label')}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const parsed = parseNumber(e.target.value);
          if (parsed === null) onChange(null);
          else if (Number.isFinite(parsed) && parsed > 0) onChange(parsed);
        }}
      />
    </div>
  );
}
