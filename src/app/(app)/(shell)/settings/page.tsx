import Link from 'next/link';
import { ChevronRight, KeyRound, ShieldCheck, SlidersHorizontal, Wrench } from 'lucide-react';
import { Ltr } from '@/components/UiComponents';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
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

/**
 * Settings (design-scope screen 8): profile, preferences, account, privacy &
 * data, and the admin tools for admins. The top bar carries the page title;
 * each section is grouped by its header icon (decision 025).
 */
export default async function SettingsPage() {
  const user = await requireOnboarded();
  const profile = await requireProfile(user.id);
  const tools = visibleAdminItems(user);
  return (
    <div className="space-y-8">
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

      <section className="space-y-3" aria-labelledby="settings-preferences">
        <SectionHeader
          icon={SlidersHorizontal}
          title={t('settings.preferences.title')}
          id="settings-preferences"
        />
        <PreferencesSection
          unitSystem={profile.unitSystem}
          weekStart={profile.weekStart}
          appearance={profile.appearance}
        />
      </section>

      <section className="space-y-3" aria-labelledby="settings-account">
        <SectionHeader icon={KeyRound} title={t('settings.account.title')} id="settings-account" />
        <Surface variant="list">
          <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
            <span className="text-sm text-muted-foreground">{t('settings.account.username')}</span>
            <span className="text-sm font-medium">
              <Ltr>{user.username}</Ltr>
            </span>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground">{t('auth.noRecovery')}</p>
        </Surface>
        <div className="grid grid-cols-2 gap-2">
          <AccountSection />
          <LogoutButton />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="settings-privacy">
        <SectionHeader
          icon={ShieldCheck}
          title={t('settings.privacy.title')}
          id="settings-privacy"
        />
        <PrivacySection username={user.username} />
      </section>

      {tools.length > 0 ? (
        <section className="space-y-3" aria-labelledby="settings-tools">
          <SectionHeader icon={Wrench} title={t('settings.tools.title')} id="settings-tools" />
          <Surface variant="list" as="ul">
            {tools.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-tint-1"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight
                    className="size-4 text-muted-foreground rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </Surface>
        </section>
      ) : null}
    </div>
  );
}
