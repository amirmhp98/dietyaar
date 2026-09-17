import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { TopBar } from '@/components/layout/TopBar';
import { requireAuth } from '@/lib/auth';
import { t } from '@/lib/t';
import { ShellActions } from './shell-actions';

/**
 * Product shell: bottom tabs (top row on md+), top bar with the profile
 * button, and the persistent Log meal button. Product pages call
 * requireOnboarded() themselves; admin pages keep their own guards.
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  await requireAuth();
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t('shell.skipToContent')}
      </a>
      <div className="flex min-h-screen flex-col md:pt-14">
        <TopBar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 md:pb-24"
        >
          {children}
        </main>
        <BottomNav />
        <ShellActions />
      </div>
    </>
  );
}
