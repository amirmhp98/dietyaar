'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

export type { DateRange };

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/t';
import { locale, type CalendarSystem } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Calendar, type CalendarProps } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Values are plain JS Dates; the `calendar` prop only changes how they are
// displayed (defaults to the locale profile).

type PickerBaseProps = {
  placeholder?: React.ReactNode;
  /** Calendar system for this field; defaults to the locale profile. */
  calendar?: CalendarSystem;
  disabled?: boolean;
  className?: string;
  /** Extra props for the underlying Calendar (e.g. `disabled` matchers, `captionLayout`). */
  calendarProps?: Omit<CalendarProps, 'mode' | 'selected' | 'onSelect' | 'calendar'>;
};

function TriggerButton({
  hasValue,
  disabled,
  className,
  children,
}: {
  hasValue: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn(
          'w-64 justify-start gap-2 font-normal',
          !hasValue && 'text-muted-foreground',
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 opacity-70" />
        <span className="truncate">{children}</span>
      </Button>
    </PopoverTrigger>
  );
}

export type DatePickerProps = PickerBaseProps & {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
};

function DatePicker({
  value,
  onChange,
  placeholder,
  calendar = locale.calendar,
  disabled,
  className,
  calendarProps,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TriggerButton hasValue={!!value} disabled={disabled} className={className}>
        {value ? formatDate(value, { calendar }) : (placeholder ?? t('ui.datePicker.placeholder'))}
      </TriggerButton>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          calendar={calendar}
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          defaultMonth={value}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  );
}

export type DateRangePickerProps = PickerBaseProps & {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
};

function DateRangePicker({
  value,
  onChange,
  placeholder,
  calendar = locale.calendar,
  disabled,
  className,
  calendarProps,
}: DateRangePickerProps) {
  const label = value?.from
    ? value.to
      ? t('ui.datePicker.rangeLabel', {
          from: formatDate(value.from, { calendar }),
          to: formatDate(value.to, { calendar }),
        })
      : formatDate(value.from, { calendar })
    : (placeholder ?? t('ui.datePicker.rangePlaceholder'));

  return (
    <Popover>
      <TriggerButton hasValue={!!value?.from} disabled={disabled} className={className}>
        {label}
      </TriggerButton>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          calendar={calendar}
          selected={value}
          onSelect={onChange}
          defaultMonth={value?.from}
          numberOfMonths={2}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, DateRangePicker };
