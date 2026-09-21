'use client';

import { Checkbox, Input, Label, Textarea } from '@/components/UiComponents';
import { t } from '@/lib/t';

/**
 * The "More details" fields the compose step and the review share (D2b):
 * date, time and "I don't remember the time"; the notes box beneath. The
 * `idPrefix` keeps the two copies' ids apart while one sheet can hold both.
 */
export function DateTimeFields({
  idPrefix,
  localDate,
  today,
  time,
  timeUnknown,
  onDateChange,
  onTimeChange,
  onTimeUnknownChange,
}: {
  idPrefix: string;
  localDate: string;
  today: string;
  time: string | null;
  timeUnknown: boolean;
  onDateChange: (localDate: string) => void;
  onTimeChange: (time: string | null) => void;
  onTimeUnknownChange: (unknown: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-date`} className="text-xs">
          {t('meal.compose.date')}
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          className="h-11 w-44"
          dir="ltr"
          max={today}
          value={localDate}
          onChange={(event) => {
            if (event.target.value) onDateChange(event.target.value);
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-time`} className="text-xs">
          {t('meal.compose.time')}
        </Label>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          className="h-11 w-32"
          dir="ltr"
          disabled={timeUnknown}
          value={time ?? ''}
          onChange={(event) => onTimeChange(event.target.value || null)}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <Checkbox
          checked={timeUnknown}
          data-testid="time-unknown"
          onCheckedChange={(checked) => onTimeUnknownChange(checked === true)}
        />
        {t('meal.compose.timeUnknown')}
      </label>
    </div>
  );
}

export function NotesField({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-notes`} className="text-xs">
        {t('meal.compose.notes')}
      </Label>
      <Textarea
        id={`${idPrefix}-notes`}
        dir="auto"
        rows={2}
        maxLength={1000}
        placeholder={t('meal.compose.notesPlaceholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
