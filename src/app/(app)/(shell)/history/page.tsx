import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { fillNames, InlineName } from '@/components/product/InlineName';
import { bandLabel } from '@/components/product/ScoreCard';
import { SectionHeader } from '@/components/product/SectionHeader';
import {
  BandGlyph,
  StatusGlyph,
  type BandGlyphName,
  type StatusGlyphName,
} from '@/components/product/StatusGlyph';
import { Surface } from '@/components/product/Surface';
import { requireOnboarded } from '@/lib/auth';
import { formatLocalDate, formatNumber } from '@/lib/format';
import type { SevenDaySummary } from '@/lib/rubric/seven-day';
import { t, tp } from '@/lib/t';
import { addDays, localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { getSevenDayView, type DayRow } from '@/services/day-view.service';
import { requireProfile } from '@/services/profile.service';
import { HistoryDatePicker } from './history-date-picker';

export const dynamic = 'force-dynamic';

/**
 * History, seven days ending today (design-scope screen 7, product spec § 10):
 * the pattern sentence with its denominators as one note surface, day rows
 * with a glyph, the band and the number, a date picker for older days. The
 * top bar carries the page title.
 */
export default async function HistoryPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const now = new Date();
  const today = localDateFor(now, APP_TIME_ZONE);
  const week = await getSevenDayView(user.id, today, now);
  const { summary } = week;

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="history-summary-title">
        <SectionHeader
          icon={CalendarDays}
          title={t('history.subtitle')}
          id="history-summary-title"
        />
        <Surface variant="note">
          <p
            className="font-display text-base font-semibold leading-snug"
            data-testid="history-summary"
          >
            {summarySentence(summary)}
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <SummaryLine icon={CircleCheck} testId="history-complete-days">
              {tp('history.summary.completeDays', summary.completeDays)}
            </SummaryLine>
            {summary.incompleteDays > 0 ? (
              <SummaryLine icon={CircleDashed} testId="history-incomplete-days">
                {tp('history.summary.incompleteDays', summary.incompleteDays)}
              </SummaryLine>
            ) : null}
            {week.planChangedInWindow ? (
              <SummaryLine icon={Info} testId="history-plan-changed">
                {t('history.planChanged')}
              </SummaryLine>
            ) : null}
            {week.historyStart ? (
              <SummaryLine icon={CalendarDays} testId="history-starts">
                {t('history.startsOn', {
                  date: formatLocalDate(week.historyStart, { month: 'short', day: 'numeric' }),
                })}
              </SummaryLine>
            ) : null}
          </ul>
        </Surface>
      </section>

      <Surface variant="list" as="ul" data-testid="history-rows">
        {[...week.rows].reverse().map((row) => (
          <DayRowItem key={row.localDate} row={row} today={today} />
        ))}
      </Surface>

      <HistoryDatePicker today={today} weekStart={profile.weekStart} />
    </div>
  );
}

function SummaryLine({
  icon: Icon,
  testId,
  children,
}: {
  icon: LucideIcon;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2" data-testid={testId}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function DayRowItem({ row, today }: { row: DayRow; today: string }) {
  const date = rowDate(row.localDate, today);
  const { glyph, text } = rowState(row);
  const { score } = row.view;
  const number = score.showNumber && score.dayScore !== null ? score.dayScore : null;
  return (
    <li>
      <Link
        href={`/history/${row.localDate}`}
        className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-tint-1"
        data-testid="history-row"
        data-state={row.state}
        aria-label={t('history.openDay', { date })}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{date}</span>
          <span
            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="history-row-state"
          >
            {glyph}
            <span className="min-w-0 truncate">{text}</span>
          </span>
        </span>
        {number !== null ? (
          <span
            className="shrink-0 font-display text-2xl font-bold tabular-nums"
            data-testid="history-row-score"
          >
            {formatNumber(number)}
          </span>
        ) : null}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function rowDate(localDate: string, today: string): string {
  const label = formatLocalDate(localDate, { weekday: 'short', month: 'short', day: 'numeric' });
  if (localDate === today) return `${t('history.today')} · ${label}`;
  if (localDate === addDays(today, -1)) return `${t('history.yesterday')} · ${label}`;
  return label;
}

// The row states the status in text, so the glyphs are decorative here.
const status = (name: StatusGlyphName) => (
  <StatusGlyph status={name} size="sm" describe={false} className="text-muted-foreground" />
);
const band = (name: BandGlyphName) => (
  <BandGlyph band={name} size="sm" describe={false} className="text-muted-foreground" />
);

/** One line per row (product spec § 10): the state, or the band when a score exists, each with its glyph. */
function rowState(row: DayRow): { glyph: React.ReactNode; text: string } {
  const { view } = row;
  const { coverage } = view.score;
  switch (row.state) {
    case 'IN_PROGRESS':
      return { glyph: band('IN_PROGRESS'), text: t('day.state.inProgress') };
    case 'NO_MEALS':
      return { glyph: status('NOT_RECORDED'), text: t('day.state.noMeals') };
    case 'INCOMPLETE':
      return { glyph: status('PARTLY'), text: t('day.state.incomplete') };
    case 'COMPLETE_BY_DEFAULT':
      return {
        glyph: status('PARTLY'),
        text: t('day.state.completeByDefault', {
          recorded: coverage.recorded,
          prescribed: coverage.prescribed,
        }),
      };
    case 'COMPLETE': {
      if (view.planStructure === null || view.planStructure === 'TARGETS_ONLY')
        return { glyph: status('RECORDED'), text: tp('history.row.meals', view.mealCount) };
      const scoreBand = view.score.band;
      if (scoreBand === 'NOT_ENOUGH')
        return { glyph: status('RECORDED'), text: t('score.notEnough') };
      return {
        glyph: band(scoreBand),
        text: `${bandLabel(scoreBand)} · ${t('history.row.coverage', { scored: coverage.scored, total: coverage.prescribed })}`,
      };
    }
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
        t(
          summary.reason === 'SKIPPED'
            ? 'history.summary.slotSkipped'
            : 'history.summary.slotDifferentFood',
          {
            slot: '{slot}',
            days: summary.days,
            complete: summary.completeDays,
          },
        ),
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
