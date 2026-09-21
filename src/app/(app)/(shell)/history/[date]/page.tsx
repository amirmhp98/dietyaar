import { notFound, redirect } from 'next/navigation';
import { ReflectionCard } from '@/components/product/ReflectionCard';
import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';
import { isValidLocalDate, localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { getDayView } from '@/services/day-view.service';
import { getMessageForDate } from '@/services/reflection.service';
import { DayBlocks } from '@/app/(app)/(shell)/today/day-blocks';
import { HistoryDayHeader } from './history-day-header';

export const dynamic = 'force-dynamic';

/**
 * One past day (design-scope screen 7 "Day"): its own header with the date
 * and "Log meal for this date", the reflection that looked back on it
 * (read-only), then the same plan / meals / completeness blocks as Today for
 * that date. Future dates 404.
 */
export default async function HistoryDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidLocalDate(date)) notFound();
  const user = await requireOnboarded();
  const now = new Date();
  const today = localDateFor(now, APP_TIME_ZONE);
  if (date > today) notFound();
  if (date === today) redirect('/today');

  const [day, message] = await Promise.all([
    getDayView(user.id, date, now),
    getMessageForDate(user.id, date),
  ]);
  return (
    <div className="space-y-6">
      <HistoryDayHeader localDate={date} />

      {message?.paragraph ? (
        <ReflectionCard
          phase="READY"
          paragraph={message.paragraph}
          stale={message.stale}
          title={t('reflection.forDate')}
        />
      ) : null}

      <DayBlocks
        localDate={date}
        zone={day.zone}
        view={day.view}
        meals={day.meals}
        draftPending={!!day.plan?.draft}
      />
    </div>
  );
}
