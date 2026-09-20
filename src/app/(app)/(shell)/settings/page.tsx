import Link from 'next/link';
import { Ltr } from '@/components/UiComponents';
import { requireOnboarded } from '@/lib/auth';
import { visibleAdminItems } from '@/lib/navigation';
import { t } from '@/lib/t';
import { requireProfile } from '@/services/profile.service';
import { AccountSection } from './account-section';
import { LogoutButton } from './logout-button';
import { PreferencesSection } from './preferences-section';
import { PrivacySection } from './privacy-section';
import { ProfileSection } from './profile-section';

export const dynamic = 'force-dynamic';

/** Settings (design-scope screen 8): profile, preferences, account, privacy & data. */
export default async function SettingsPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const tools = visibleAdminItems(user);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>

      <Section id="profile" title={t('settings.profile.title')}>
        <ProfileSection
          profile={{
            ageYears: profile.ageYears,
            sex: profile.sex,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            weightMeasuredAt: profile.weightMeasuredAt,
            displayName: profile.displayName,
            goal: profile.goal,
            restrictionsOriginal: profile.restrictionsOriginal,
            unitSystem: profile.unitSystem,
          }}
        />
      </Section>

      <Section id="preferences" title={t('settings.preferences.title')}>
        <PreferencesSection
          unitSystem={profile.unitSystem}
          weekStart={profile.weekStart}
          appearance={profile.appearance}
        />
      </Section>

      <Section id="account" title={t('settings.account.title')}>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('settings.account.username')}</p>
          <p className="text-base font-medium">
            <Ltr>{user.username}</Ltr>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t('auth.noRecovery')}</p>
        </div>
        <AccountSection />
        <LogoutButton />
      </Section>

      <Section id="privacy" title={t('settings.privacy.title')}>
        <PrivacySection username={user.username} />
      </Section>

      {tools.length > 0 ? (
        <Section id="tools" title={t('settings.tools.title')}>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {tools.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm hover:bg-accent"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`settings-${id}`}>
      <h2 id={`settings-${id}`} className="text-sm font-medium text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
