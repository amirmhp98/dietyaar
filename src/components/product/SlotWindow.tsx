import { formatClockTime } from '@/lib/format';
import type { SlotWindow } from '@/lib/rubric/windows';
import { t } from '@/lib/t';

/**
 * A slot's time window as text: "12:00–15:30" when the plan states it,
 * "≈ 12:00–15:30" when it was assumed from the name (product spec § 6), a
 * bare "12:00" for a stated single time.
 */
export function slotWindowText(window: SlotWindow): string {
  const start = formatClockTime(window.start);
  if (window.end === null) return start;
  const end = formatClockTime(window.end);
  return window.assumed
    ? t('plan.time.assumedRange', { start, end })
    : t('plan.time.range', { start, end });
}

export function SlotWindowText({ window, className }: { window: SlotWindow; className?: string }) {
  return (
    <span dir="ltr" className={className} data-testid="slot-window">
      {slotWindowText(window)}
    </span>
  );
}
