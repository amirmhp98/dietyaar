import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Disclosure } from '@/components/product/Disclosure';
import { fillNames, InlineName } from '@/components/product/InlineName';
import { requireOnboarded } from '@/lib/auth';
import { formatLocalDate } from '@/lib/format';
import type { SevenDaySummary } from '@/lib/rubric/seven-day';
import { t, tp } from '@/lib/t';
import { addDays, localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { getSevenDayView, type DayRow } from '@/services/day-view.service';
import { requireProfile } from '@/services/profile.service';
import { HistoryDatePicker } from './history-date-picker';
import { ruleStatus } from './rule-status';

export const dynamic = 'force-dynamic';

/**
 * History, seven days ending today (design-scope screen 7, product spec § 10):
 * one pattern sentence with denominators, day rows, weekly rules, a date
 * picker for older days.
 */
export default async function HistoryPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const now = new Date();
  const today = localDateFor(now, APP_TIME_ZONE);
  const week = await getSevenDayView(user.id, today, now);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('history.subtitle')}</p>
      </header>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <p className="text-sm" data-testid="history-summary">
          {summarySentence(week.summary)}
        </p>
        {week.summary.incompleteDays > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="history-incomplete-days">
            {tp('history.summary.incompleteDays', week.summary.incompleteDays)}
          </p>
        ) : null}
        {week.planChangedInWindow ? (
          <p className="text-xs text-muted-foreground" data-testid="history-plan-changed">
            {t('history.planChanged')}
          </p>
        ) : null}
      </section>

      <ul
        className="divide-y divide-border rounded-xl border border-border bg-card"
        data-testid="history-rows"
      >
        {[...week.rows].reverse().map((row) => (
          <li key={row.localDate}>
            <Link
              href={`/history/${row.localDate}`}
              className="flex min-h-14 items-center gap-3 px-3 py-3 hover:bg-accent"
              data-testid="history-row"
              data-state={row.state}
              aria-label={t('history.openDay', { date: rowDate(row.localDate, today) })}
            >
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-sm font-medium">{rowDate(row.localDate, today)}</span>
                <span
                  className="block text-xs text-muted-foreground"
                  data-testid="history-row-state"
                >
                  {rowState(row)}
                </span>
              </span>
              {row.view.score.showNumber && row.view.score.dayScore !== null ? (
                <span
                  className="text-xl font-semibold tabular-nums"
                  data-testid="history-row-score"
                >
                  {row.view.score.dayScore}
                </span>
              ) : null}
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      {week.historyStart ? (
        <p className="text-xs text-muted-foreground" data-testid="history-starts">
          {t('history.startsOn', {
            date: formatLocalDate(week.historyStart, { month: 'short', day: 'numeric' }),
          })}
        </p>
      ) : null}

      {week.weeklyRules.length > 0 ? (
        <div className="rounded-xl border border-border bg-card px-3 py-1">
          <Disclosure label={t('history.weeklyRules')} testId="weekly-rules">
            <ul className="space-y-3 text-sm">
              {week.weeklyRules.map((rule) => (
                <li key={rule.rule.id} className="space-y-0.5">
                  <p className="bidi-plaintext">{rule.rule.originalText}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('day.rule.period.week')} · {ruleStatus(rule.observation)}
                  </p>
                  {rule.planChangedInPeriod ? (
                    <p className="text-xs text-muted-foreground">{t('day.rule.planChanged')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}

      <HistoryDatePicker today={today} weekStart={profile.weekStart} />
    </div>
  );
}

function rowDate(localDate: string, today: string): string {
  const label = formatLocalDate(localDate, { weekday: 'short', month: 'short', day: 'numeric' });
  if (localDate === today) return `${t('history.today')} · ${label}`;
  if (localDate === addDays(today, -1)) return `${t('history.yesterday')} · ${label}`;
  return label;
}

function bandLabel(row: DayRow): string {
  const { band } = row.view.score;
  return band === 'CLOSELY'
    ? t('score.band.closely')
    : band === 'MOSTLY'
      ? t('score.band.mostly')
      : band === 'DIFFERENT'
        ? t('score.band.different')
        : t('score.notEnough');
}

/** One line per row (product spec § 10): the state, or the band when a score exists. */
function rowState(row: DayRow): string {
  const { view } = row;
  const { coverage } = view.score;
  switch (row.state) {
    case 'IN_PROGRESS':
      return t('day.state.inProgress');
    case 'NO_MEALS':
      return t('day.state.noMeals');
    case 'INCOMPLETE':
      return t('day.state.incomplete');
    case 'COMPLETE_BY_DEFAULT':
      return t('day.state.completeByDefault', {
        recorded: coverage.recorded,
        prescribed: coverage.prescribed,
      });
    case 'COMPLETE':
      if (view.planStructure === null || view.planStructure === 'TARGETS_ONLY')
        return tp('history.row.meals', view.mealCount);
      return view.score.band === 'NOT_ENOUGH'
        ? t('score.notEnough')
        : `${bandLabel(row)} · ${tp('score.coverage', coverage.scored, { total: coverage.prescribed })}`;
  }
}

function summarySentence(summary: SevenDaySummary) {
  const n = (kind: 'slot' | 'item', name: { originalName: string; englishLabel: string }) => ({
    [kind]: <InlineName name={name} />,
  });
  switch (summary.kind) {
    case 'NOT_ENOUGH':
      return t('history.summary.notEnough');
    case 'SLOT_DIFFERENT':
      return fillNames(
        t('history.summary.slotDifferent', {
          slot: '{slot}',
          days: summary.days,
          complete: summary.completeDays,
        }),
        n('slot', summary.slot),
      );
    case 'PORTION':
      return fillNames(
        t(
          summary.direction === 'MORE'
            ? 'history.summary.portionMore'
            : 'history.summary.portionLess',
          {
            item: '{item}',
            days: summary.days,
            complete: summary.completeDays,
          },
        ),
        n('item', summary.item),
      );
    case 'ORDER':
      return fillNames(
        t('history.summary.order', {
          slot: '{slot}',
          days: summary.days,
          complete: summary.completeDays,
        }),
        n('slot', summary.slot),
      );
    case 'ENERGY': {
      const key =
        summary.status === 'WITHIN'
          ? 'history.summary.energyWithin'
          : summary.status === 'ABOVE'
            ? 'history.summary.energyAbove'
            : 'history.summary.energyBelow';
      return t(key, { days: summary.days, complete: summary.completeDays });
    }
    case 'MATCHED_MOST':
      return fillNames(
        t('history.summary.matchedMost', {
          slot: '{slot}',
          days: summary.days,
          complete: summary.completeDays,
        }),
        n('slot', summary.slot),
      );
    case 'NO_PATTERN':
      return t('history.summary.noPattern', { complete: summary.completeDays });
  }
}
