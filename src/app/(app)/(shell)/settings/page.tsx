import { requireOnboarded } from '@/lib/auth';
import { Ltr } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { visibleAdminItems } from '@/lib/navigation';
import Link from 'next/link';
import { LogoutButton } from './logout-button';

/** Account section now; profile, preferences and privacy sections arrive in phase 10. */
export default async function SettingsPage() {
  const user = await requireOnboarded();
  const tools = visibleAdminItems(user);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
      <section className="space-y-3" aria-labelledby="settings-account">
        <h2 id="settings-account" className="text-sm font-medium text-muted-foreground">
          {t('settings.account.title')}
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('settings.account.username')}</p>
          <p className="text-base font-medium">
            <Ltr>{user.username}</Ltr>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t('auth.noRecovery')}</p>
        </div>
        <LogoutButton />
      </section>
      {tools.length > 0 ? (
        <section className="space-y-3" aria-labelledby="settings-tools">
          <h2 id="settings-tools" className="text-sm font-medium text-muted-foreground">
            {t('settings.tools.title')}
          </h2>
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
        </section>
      ) : null}
    </div>
  );
}
