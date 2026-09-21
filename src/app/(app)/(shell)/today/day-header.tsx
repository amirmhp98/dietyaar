import { formatLocalDate } from '@/lib/format';

/** Full date of a local day, e.g. "Wednesday, September 17, 2026". */
export function fullDate(localDate: string): string {
  return formatLocalDate(localDate, { dateStyle: 'full' });
}

/** Today's page header: the date in the display face and the greeting line. */
export function DayHeader({ localDate, greeting }: { localDate: string; greeting: string }) {
  return (
    <header className="space-y-1">
      <h1 className="font-display text-2xl font-semibold leading-tight" data-testid="day-date">
        {fullDate(localDate)}
      </h1>
      <p
        className="bidi-plaintext font-display text-base text-muted-foreground"
        data-testid="greeting"
      >
        {greeting}
      </p>
    </header>
  );
}
