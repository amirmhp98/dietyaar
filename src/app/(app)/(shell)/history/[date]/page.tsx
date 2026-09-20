import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Disclosure } from '@/components/product/Disclosure';
import { ReflectionCard } from '@/components/product/ReflectionCard';
import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';
import { isValidLocalDate, localDateFor } from '@/lib/time/local-date';
import { getDayView } from '@/services/day-view.service';
import { requireProfile } from '@/services/profile.service';
import { getMessageForDate } from '@/services/reflection.service';
import { DayBlocks } from '../../today/day-blocks';
import { DayHeader } from '../../today/day-header';
import { ruleStatus } from '../rule-status';

export const dynamic = 'force-dynamic';

/**
 * One past day (design-scope screen 7 "Day"): the reflection that looked
 * back on it (read-only), the same plan / meals / completeness blocks as
 * Today for that date, and "Log meal for this date". Future dates 404.
 */
export default async function HistoryDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidLocalDate(date)) notFound();
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const now = new Date();
  const today = localDateFor(now, profile.timeZone);
  if (date > today) notFound();
  if (date === today) redirect('/today');

  const [day, message] = await Promise.all([
    getDayView(user.id, date, now),
    getMessageForDate(user.id, date),
  ]);
  const rules = day.view.rules.map((observation) => ({
    observation,
    text: day.plan?.rules.find((r) => r.id === observation.ruleId)?.originalText ?? null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/history"
        className="-ms-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('history.day.backToHistory')}
      </Link>
      <DayHeader localDate={date} zone={day.zone} />

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
        draftPending={day.plan?.draft !== null && day.plan?.draft !== undefined}
      />

      {rules.length > 0 ? (
        <div className="rounded-xl border border-border bg-card px-3 py-1">
          <Disclosure label={t('day.rules')} testId="day-rules">
            <ul className="space-y-3 text-sm">
              {rules.map(({ observation, text }) => (
                <li key={observation.ruleId} className="space-y-0.5">
                  {text ? <p className="bidi-plaintext">{text}</p> : null}
                  <p className="text-xs text-muted-foreground">{ruleStatus(observation)}</p>
                </li>
              ))}
              {day.planChangedInPeriod ? (
                <li className="text-xs text-muted-foreground">{t('day.rule.planChanged')}</li>
              ) : null}
            </ul>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}
