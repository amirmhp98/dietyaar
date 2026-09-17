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
import { UNITS } from '@/lib/units';

const NONE = '__none';
const OTHER = '__other';

/**
 * Unit picker for plan items: the regional unit table (product spec § 6)
 * plus "no unit" and a free-text unit kept as written.
 */
export function UnitSelect({
  value,
  onChange,
  id,
  ariaLabel,
}: {
  value: string | null;
  onChange: (unit: string | null) => void;
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
              {unit.label}
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
    </div>
  );
}
