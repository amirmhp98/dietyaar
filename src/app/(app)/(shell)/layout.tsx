import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { TopBar } from '@/components/layout/TopBar';
import { requireAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { t } from '@/lib/t';
import { ReflectionTrigger } from './reflection-trigger';
import { ShellActions } from './shell-actions';

/**
 * Product shell: one top bar (title on phones, the primary tabs on wider
 * screens, the profile button), bottom tabs on phones, and the persistent
 * Log meal button. Product pages call requireOnboarded() themselves; admin
 * pages keep their own guards.
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  const onboarded = user.onboardingStep === 'DONE';
  const photoEnabled = env.PHOTO_LOGGING_ENABLED;
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t('shell.skipToContent')}
      </a>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 md:pb-24"
        >
          {children}
        </main>
        <BottomNav />
        {onboarded ? (
          <>
            <ShellActions photoEnabled={photoEnabled} />
            <ReflectionTrigger />
          </>
        ) : null}
      </div>
    </>
  );
}
