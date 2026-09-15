'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  DayPicker as GregorianDayPickerBase,
  defaultDateLib,
  getDefaultClassNames,
  type DayButton,
  type DayPickerLocale,
  type DayPickerProps,
} from 'react-day-picker';
import { enUS as enUSGregorian, faIR as faIRGregorian } from 'react-day-picker/locale';

import { cn } from '@/lib/utils';
import { locale, type CalendarSystem } from '@/lib/locale';
import { Button, buttonVariants } from '@/components/ui/button';
import { useDir } from '@/components/ui/direction';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Calendar systems
//
// The calendar is presentation only: values are plain JS Dates (store ISO/UTC).
// Which system renders comes from the locale profile, overridable per field
// with the `calendar` prop (a Gregorian passport date inside a Persian app).
// Month/weekday labels follow the profile's *language* independently of the
// calendar, so a Persian app shows "ژانویه" for Gregorian and an English app
// shows "Farvardin" for Jalali.
//
// The Jalali adapter (date-fns-jalali) is loaded on demand so a Gregorian-only
// build never downloads it.
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return <Skeleton className="h-72 w-64 rounded-md" aria-busy="true" />;
}

function GregorianDayPicker({ formatters, ...props }: DayPickerProps) {
  return (
    <GregorianDayPickerBase
      locale={locale.lang === 'fa' ? faIRGregorian : enUSGregorian}
      formatters={{
        // Persian weekday headers as single letters (ش ی د …), like the Jalali entry.
        formatWeekdayName: (date, options, dateLib) =>
          (dateLib ?? defaultDateLib).format(
            date,
            locale.lang === 'fa' ? 'ccccc' : 'cccccc',
            options,
          ),
        ...formatters,
      }}
      {...props}
    />
  );
}

const JalaliDayPicker = dynamic<DayPickerProps>(
  () =>
    import('react-day-picker/persian').then(({ DayPicker, faIR, enUS }) => {
      function Jalali({ locale: localeProp, ...props }: DayPickerProps) {
        const jalaliLocale =
          (localeProp as DayPickerLocale | undefined) ?? (locale.lang === 'fa' ? faIR : enUS);
        return <DayPicker locale={jalaliLocale} {...props} />;
      }
      return Jalali;
    }),
  { loading: CalendarSkeleton },
);

export type CalendarProps = DayPickerProps & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
  /** Calendar system for this instance; defaults to the locale profile. */
  calendar?: CalendarSystem;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  calendar = locale.calendar,
  numerals = locale.numerals,
  weekStartsOn = locale.weekStartsOn,
  dir,
  modifiers,
  modifiersClassNames,
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  const pageDir = useDir();
  const DayPicker = calendar === 'persian' ? JalaliDayPicker : GregorianDayPicker;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      dir={dir ?? pageDir}
      numerals={numerals}
      weekStartsOn={weekStartsOn}
      modifiers={{
        weekend: (date) =>
          locale.weekend.includes(date.getDay() as (typeof locale.weekend)[number]),
        ...modifiers,
      }}
      modifiersClassNames={{
        weekend: '[&>button]:text-destructive/80',
        ...modifiersClassNames,
      }}
      className={cn(
        'bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn('bg-popover absolute inset-0 opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'select-none font-medium',
          captionLayout === 'label'
            ? 'text-sm'
            : '[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md ps-2 pe-1 text-sm [&>svg]:size-3.5',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
        week_number: cn(
          'text-muted-foreground select-none text-[0.8rem]',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-s-md [&:last-child[data-selected=true]_button]:rounded-e-md',
          defaultClassNames.day,
        ),
        range_start: cn('bg-accent rounded-s-md', defaultClassNames.range_start),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn('bg-accent rounded-e-md', defaultClassNames.range_end),
        today: cn(
          'bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === 'left') {
            return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
          }

          if (orientation === 'right') {
            return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
          }

          return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
