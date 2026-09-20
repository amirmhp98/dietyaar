'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/UiComponents';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

/**
 * Two-state day completeness checkbox, checked by default (product spec § 8),
 * on a note surface at the end of the day. The helper line changes on a past
 * day with unrecorded slots.
 */
export function CompletenessCheckbox({
  checked,
  onChange,
  helper,
  pending,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  pending?: boolean;
}) {
  const id = useId();
  return (
    <Surface variant="note">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          disabled={pending}
          onCheckedChange={(value) => onChange(value === true)}
          className="mt-0.5 size-5"
          data-testid="completeness"
        />
        <div className="space-y-1">
          <label htmlFor={id} className="block min-h-6 cursor-pointer text-sm font-medium">
            {t('day.completeness.label')}
          </label>
          <p className="text-xs text-muted-foreground">{helper ?? t('day.completeness.helper')}</p>
        </div>
      </div>
    </Surface>
  );
}
