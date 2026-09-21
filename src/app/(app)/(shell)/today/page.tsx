import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';
import { localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { getDayView } from '@/services/day-view.service';
import { greetingNameFor, requireProfile } from '@/services/profile.service';
import { peekMessage } from '@/services/reflection.service';
import { DayBlocks } from './day-blocks';
import { DayHeader } from './day-header';
import { ImportBanner } from './import-banner';

export const dynamic = 'force-dynamic';

/**
 * Today (design-scope screen 3, product spec § 9): header, import banner,
 * reflection, Your plan today, Recorded meals, completeness. The day is read
 * in the app zone; the composer and the Log meal button come from the shell.
 */
export default async function TodayPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const now = new Date();
  const localDate = localDateFor(now, APP_TIME_ZONE);
  const [day, message] = await Promise.all([
    getDayView(user.id, localDate, now),
    peekMessage(user.id, localDate),
  ]);
  const draft = day.plan?.draft ?? null;

  return (
    <div className="space-y-6">
      <DayHeader
        localDate={localDate}
        greeting={t('today.greeting', { name: greetingNameFor(profile, user) })}
      />
      {draft ? <ImportBanner state={draft.state} /> : null}
      <DayBlocks
        localDate={localDate}
        zone={day.zone}
        view={day.view}
        meals={day.meals}
        draftPending={draft !== null}
        reflection={{ acknowledged: message?.acknowledged ?? false }}
      />
    </div>
  );
}
