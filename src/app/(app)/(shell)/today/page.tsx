import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';
import { localDateFor } from '@/lib/time/local-date';
import { getDayView } from '@/services/day-view.service';
import { greetingNameFor, requireProfile } from '@/services/profile.service';
import { peekMessage } from '@/services/reflection.service';
import { DayBlocks } from './day-blocks';
import { DayHeader } from './day-header';
import { ImportBanner } from './import-banner';
import { TimeZoneHint } from './time-zone-hint';

export const dynamic = 'force-dynamic';

/**
 * Today (design-scope screen 3, product spec § 9): header, import banner,
 * reflection, Your plan today, Recorded meals, completeness. The day is read
 * in the profile zone; the composer and the Log meal button come from the shell.
 */
export default async function TodayPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const now = new Date();
  const localDate = localDateFor(now, profile.timeZone);
  const [day, message] = await Promise.all([
    getDayView(user.id, localDate, now),
    peekMessage(user.id, localDate),
  ]);
  const draft = day.plan?.draft ?? null;

  return (
    <div className="space-y-6">
      <DayHeader
        localDate={localDate}
        zone={profile.timeZone}
        greeting={t('today.greeting', { name: greetingNameFor(profile, user) })}
      />
      <TimeZoneHint
        profileZone={profile.timeZone}
        lastSeenDeviceZone={profile.lastSeenDeviceTimeZone}
        dismissed={profile.timeZoneHintDismissedAt !== null}
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
