'use client';

import { useRouter } from 'next/navigation';
import { DatePicker } from '@/components/UiComponents';
import { t } from '@/lib/t';

function toLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromLocalDate(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Older days (design-scope screen 7): the profile's week start, nothing after today. */
export function HistoryDatePicker({ today, weekStart }: { today: string; weekStart: number }) {
  const router = useRouter();
  return (
    <DatePicker
      placeholder={t('history.pickDate')}
      className="h-11 w-full"
      onChange={(date) => {
        if (date) router.push(`/history/${toLocalDate(date)}`);
      }}
      calendarProps={{
        weekStartsOn: weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        disabled: { after: fromLocalDate(today) },
        defaultMonth: fromLocalDate(today),
      }}
    />
  );
}
