import { formatDate } from '@/lib/format';
import { instantFor } from '@/lib/time/local-date';

/** Full date of a local day in its zone, e.g. "Wednesday, September 17, 2026". */
export function fullDate(localDate: string, zone: string): string {
  return formatDate(instantFor(localDate, '12:00', zone), { timeZone: zone, dateStyle: 'full' });
}

/** Page header shared by Today and a History day: the date in the display face, and an optional greeting line. */
export function DayHeader({
  localDate,
  zone,
  greeting,
  eyebrow,
}: {
  localDate: string;
  zone: string;
  greeting?: string;
  eyebrow?: string;
}) {
  return (
    <header className="space-y-1">
      {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
      <h1 className="font-display text-2xl font-semibold leading-tight" data-testid="day-date">
        {fullDate(localDate, zone)}
      </h1>
      {greeting ? (
        <p
          className="bidi-plaintext font-display text-base text-muted-foreground"
          data-testid="greeting"
        >
          {greeting}
        </p>
      ) : null}
    </header>
  );
}
