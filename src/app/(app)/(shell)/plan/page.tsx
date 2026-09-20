import Link from 'next/link';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UiComponents';
import { Disclosure } from '@/components/product/Disclosure';
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

export const dynamic = 'force-dynamic';

/** My plan (design-scope screen 6): the confirmed plan, read-only, with Edit / Replace / Delete. */
export default async function PlanPage() {
  const user = await requireOnboarded();
  const now = new Date();
  const [profile, plan] = await Promise.all([requireProfile(user.id), getPlan(user.id)]);
  const active = isActive(plan);
  const today = weekdayOf(localDateFor(now, APP_TIME_ZONE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('plan.page.title')}</h1>

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
          <section className="space-y-1 rounded-xl border border-border bg-card p-4">
            <p className="text-lg font-semibold" dir="auto">
              <bdi>{plan.name ?? t('plan.page.title')}</bdi>
            </p>
            {plan.sourceNote ? (
              <p className="text-sm text-muted-foreground" dir="auto">
                {t('plan.page.source', { note: plan.sourceNote })}
              </p>
            ) : null}
            {plan.confirmedAt ? (
              <p className="text-xs text-muted-foreground">
                {t('plan.page.confirmedOn', {
                  date: formatDate(plan.confirmedAt, { timeZone: APP_TIME_ZONE }),
                })}
              </p>
            ) : null}
          </section>

          {profile.goal ? (
            <Section title={t('plan.page.goal')}>
              <p className="rounded-xl border border-border bg-card p-4 text-sm" dir="auto">
                <bdi>{profile.goal}</bdi>
              </p>
            </Section>
          ) : null}

          <MealsSection plan={plan} today={today} weekStart={profile.weekStart} />

          <Section title={t('plan.page.targets')}>
            <DailyTargets plan={plan} />
          </Section>

          {plan.notes.length > 0 ? (
            <Section title={t('plan.page.notes')}>
              <p className="text-xs text-muted-foreground">{t('plan.review.notes.hint')}</p>
              <ul
                className="divide-y divide-border rounded-xl border border-border bg-card"
                data-testid="plan-notes"
              >
                {plan.notes.map((note) => (
                  <li key={note.id} className="space-y-1 p-3 text-sm">
                    <p dir="auto">
                      <bdi>{note.originalText}</bdi>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`plan.review.notes.reason.${noteReason(note.reason)}`)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {plan.sourceText ? (
            <Disclosure label={t('plan.page.sourceText')} testId="plan-source-text">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm" dir="auto">
                <bdi>{plan.sourceText}</bdi>
              </p>
            </Disclosure>
          ) : null}

          <PlanActions planName={plan.name} />
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

function EmptyState() {
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      data-testid="plan-empty"
    >
      <p className="text-lg font-semibold">{t('plan.page.empty')}</p>
      <p className="text-sm text-muted-foreground">{t('plan.page.emptyBody')}</p>
      <Button asChild className="h-11 w-full">
        <Link href="/plan/add">{t('plan.page.addPlan')}</Link>
      </Button>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
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
      <Section title={t('plan.page.meals')}>
        <p className="text-sm text-muted-foreground">{t('plan.page.noSlots')}</p>
      </Section>
    );
  }
  const rangeFor = (slotId: string) =>
    plan.targets.find((x) => x.planSlotId === slotId && x.nutrient === 'ENERGY_KCAL') ?? null;

  if (plan.structure !== 'BY_WEEKDAY') {
    return (
      <Section title={t('plan.page.todaysMeals')}>
        <ul className="space-y-3">
          {slotsForWeekday(plan, EVERY_DAY).map((slot) => (
            <PlanSlotSummary key={slot.id} slot={slot} range={rangeFor(slot.id)} />
          ))}
        </ul>
      </Section>
    );
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7).filter((d) =>
    plan.slots.some((s) => s.weekday === d),
  );
  const initial = weekdays.includes(today) ? today : weekdays[0];
  return (
    <Section title={t('plan.page.meals')}>
      <Tabs defaultValue={String(initial)} className="gap-3">
        <TabsList
          className="w-full justify-start overflow-x-auto"
          aria-label={t('plan.page.meals')}
        >
          {weekdays.map((d) => (
            <TabsTrigger key={d} value={String(d)} className="min-h-11 px-3">
              {weekdayName(d, 'short')}
            </TabsTrigger>
          ))}
        </TabsList>
        {weekdays.map((d) => (
          <TabsContent key={d} value={String(d)}>
            <ul className="space-y-3">
              {slotsForWeekday(plan, d).map((slot) => (
                <PlanSlotSummary key={slot.id} slot={slot} range={rangeFor(slot.id)} />
              ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}

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
    <div className="space-y-2">
      {[...groups.entries()].map(([weekday, targets]) => (
        <div key={String(weekday)} className="space-y-1">
          {weekday !== null ? <p className="text-sm font-medium">{weekdayName(weekday)}</p> : null}
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {targets.map((target) => (
              <li key={target.id} className="space-y-0.5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{nutrientLabel(target.nutrient)}</span>
                  <span className="shrink-0 text-sm" dir="ltr">
                    {targetValueText(target)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{targetSourceLabel(target.source)}</p>
              </li>
            ))}
          </ul>
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
