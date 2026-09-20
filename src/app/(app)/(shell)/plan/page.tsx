import Link from 'next/link';
import {
  ClipboardList,
  FileText,
  Flag,
  Plus,
  StickyNote,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UiComponents';
import { Disclosure } from '@/components/product/Disclosure';
import { Illustration } from '@/components/product/Illustration';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import {
  targetSourceLabel,
  targetValueText,
  nutrientLabel,
  weekdayName,
} from '@/components/product/plan-review/helpers';
import { requireOnboarded } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/t';
import { APP_TIME_ZONE, localDateFor, weekdayOf } from '@/lib/time';
import { EVERY_DAY, NOTE_REASONS } from '@/lib/validations/plan';
import { getPlan, slotsForWeekday, type PlanView } from '@/services/plan.service';
import { requireProfile } from '@/services/profile.service';
import { PlanSlotSummary } from './PlanSlotSummary';
import { PlanActions } from './plan-actions';
import { PlanDraftBanner } from './plan-draft-banner';
import { PlanSlotList } from './plan-slot-list';

export const dynamic = 'force-dynamic';

/**
 * My plan (design-scope screen 6, decision 025): the confirmed plan as a
 * header with its actions, slot cards folded after the first two, targets,
 * notes and the source text. The top bar carries the page title.
 */
export default async function PlanPage() {
  const user = await requireOnboarded();
  const now = new Date();
  const [profile, plan] = await Promise.all([requireProfile(user.id), getPlan(user.id)]);
  const active = isActive(plan);
  const today = weekdayOf(localDateFor(now, APP_TIME_ZONE));

  return (
    <div className="space-y-6">
      {plan?.draft ? (
        <PlanDraftBanner
          kind={plan.draft.kind}
          state={plan.draft.state}
          continueHref={
            plan.draft.kind === 'MANUAL' && plan.draftJson?.manualStep !== 'review'
              ? '/plan/add/manual'
              : '/plan/review'
          }
        />
      ) : null}

      {!active || !plan ? (
        <EmptyState />
      ) : (
        <>
          <header className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 font-display text-2xl font-semibold leading-tight" dir="auto">
                <bdi>{plan.name ?? t('plan.page.title')}</bdi>
              </h2>
              <PlanActions planName={plan.name} />
            </div>
            {plan.sourceNote ? (
              <p
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
                dir="auto"
                data-testid="plan-source"
              >
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span>{t('plan.page.source', { note: plan.sourceNote })}</span>
              </p>
            ) : null}
            {plan.confirmedAt ? (
              <p className="text-xs text-muted-foreground">
                {t('plan.page.confirmedOn', {
                  date: formatDate(plan.confirmedAt, { timeZone: APP_TIME_ZONE }),
                })}
              </p>
            ) : null}
          </header>

          {profile.goal ? (
            <Section icon={Flag} title={t('plan.page.goal')} id="goal">
              <Surface variant="note" rule>
                <p className="text-sm" dir="auto">
                  <bdi>{profile.goal}</bdi>
                </p>
              </Surface>
            </Section>
          ) : null}

          <MealsSection plan={plan} today={today} weekStart={profile.weekStart} />

          <Section icon={Target} title={t('plan.page.targets')} id="targets">
            <DailyTargets plan={plan} />
          </Section>

          {plan.notes.length > 0 ? (
            <Section icon={StickyNote} title={t('plan.page.notes')} id="notes">
              <Surface variant="note" padding="none">
                <ul className="divide-y divide-border/60" data-testid="plan-notes">
                  {plan.notes.map((note) => (
                    <li key={note.id} className="space-y-0.5 px-4 py-3 text-sm">
                      <p dir="auto">
                        <bdi>{note.originalText}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`plan.review.notes.reason.${noteReason(note.reason)}`)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">
                  {t('plan.review.notes.hint')}
                </p>
              </Surface>
            </Section>
          ) : null}

          {plan.sourceText ? (
            <Disclosure label={t('plan.page.sourceText')} testId="plan-source-text">
              <Surface variant="note" padding="sm">
                <p className="whitespace-pre-wrap text-sm" dir="auto">
                  <bdi>{plan.sourceText}</bdi>
                </p>
              </Surface>
            </Disclosure>
          ) : null}
        </>
      )}
    </div>
  );
}

/** "Has an active plan": confirmed rows exist (a targets-only plan needs targets only). */
function isActive(plan: PlanView | null): plan is PlanView {
  if (!plan || plan.confirmedAt === null) return false;
  if (plan.structure === 'TARGETS_ONLY') return plan.targets.length > 0;
  return plan.slots.length > 0;
}

/** No plan yet: an illustration, one line, one outline action (the floating button is the filled one). */
function EmptyState() {
  return (
    <Surface
      variant="note"
      className="flex flex-col items-center gap-3 py-8 text-center"
      data-testid="plan-empty"
    >
      <Illustration name="noPlan" />
      <p className="font-display text-lg font-semibold">{t('plan.page.empty')}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{t('plan.page.emptyBody')}</p>
      <Button asChild variant="outline" className="mt-1">
        <Link href="/plan/add">
          <Plus aria-hidden="true" />
          {t('plan.page.addPlan')}
        </Link>
      </Button>
    </Surface>
  );
}

function Section({
  icon,
  title,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`plan-${id}-title`}>
      <SectionHeader icon={icon} title={title} id={`plan-${id}-title`} />
      {children}
    </section>
  );
}

function MealsSection({
  plan,
  today,
  weekStart,
}: {
  plan: PlanView;
  today: number;
  weekStart: number;
}) {
  if (plan.structure === 'TARGETS_ONLY' || plan.slots.length === 0) {
    return (
      <Section icon={ClipboardList} title={t('plan.page.meals')} id="meals">
        <p className="text-sm text-muted-foreground">{t('plan.page.noSlots')}</p>
      </Section>
    );
  }
  const rangeFor = (slotId: string) =>
    plan.targets.find((x) => x.planSlotId === slotId && x.nutrient === 'ENERGY_KCAL') ?? null;
  const cardsFor = (weekday: number) =>
    slotsForWeekday(plan, weekday).map((slot) => (
      <PlanSlotSummary key={slot.id} slot={slot} range={rangeFor(slot.id)} />
    ));

  if (plan.structure !== 'BY_WEEKDAY') {
    return (
      <Section icon={ClipboardList} title={t('plan.page.todaysMeals')} id="meals">
        <PlanSlotList cards={cardsFor(EVERY_DAY)} />
      </Section>
    );
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7).filter((d) =>
    plan.slots.some((s) => s.weekday === d),
  );
  const initial = weekdays.includes(today) ? today : weekdays[0];
  return (
    <Section icon={ClipboardList} title={t('plan.page.meals')} id="meals">
      <Tabs defaultValue={String(initial)} className="gap-3">
        <TabsList
          variant="pills"
          className="w-full justify-start overflow-x-auto"
          aria-label={t('plan.page.meals')}
        >
          {weekdays.map((d) => (
            <TabsTrigger key={d} value={String(d)} className="min-h-11 rounded-full px-3">
              {weekdayName(d, 'short')}
            </TabsTrigger>
          ))}
        </TabsList>
        {weekdays.map((d) => (
          <TabsContent key={d} value={String(d)}>
            <PlanSlotList cards={cardsFor(d)} />
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}

/** Daily targets as a two-column list: nutrient and where it comes from, value at the end. */
function DailyTargets({ plan }: { plan: PlanView }) {
  const daily = plan.targets.filter((x) => x.planSlotId === null);
  if (daily.length === 0)
    return <p className="text-sm text-muted-foreground">{t('plan.target.none')}</p>;
  const groups = new Map<number | null, typeof daily>();
  for (const target of daily) {
    const key = target.weekday === null || target.weekday === EVERY_DAY ? null : target.weekday;
    groups.set(key, [...(groups.get(key) ?? []), target]);
  }
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([weekday, targets]) => (
        <div key={String(weekday)} className="space-y-1.5">
          {weekday !== null ? <p className="text-sm font-medium">{weekdayName(weekday)}</p> : null}
          <Surface variant="list" as="ul">
            {targets.map((target) => (
              <li
                key={target.id}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{nutrientLabel(target.nutrient)}</p>
                  <p className="text-xs text-muted-foreground">
                    {targetSourceLabel(target.source)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums" dir="ltr">
                  {targetValueText(target)}
                </span>
              </li>
            ))}
          </Surface>
        </div>
      ))}
    </div>
  );
}

function noteReason(reason: string): (typeof NOTE_REASONS)[number] {
  return (NOTE_REASONS as readonly string[]).includes(reason)
    ? (reason as (typeof NOTE_REASONS)[number])
    : 'OTHER';
}
