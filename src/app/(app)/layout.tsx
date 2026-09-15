import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { requireAuth } from '@/lib/auth';
import { SIDEBAR_COLLAPSED_COOKIE } from '@/lib/preferences';
import { t } from '@/lib/t';

/**
 * Authenticated area. Every route under (app) gets the shell and a verified
 * user. Pages still call requireAuth()/requireAdmin() before fetching data,
 * because Next.js renders layouts and pages in parallel; the call is cached
 * per request so it costs nothing.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireAuth(), cookies()]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === 'true';

  return (
    <AuthProvider user={user}>
      <SidebarProvider defaultCollapsed={sidebarCollapsed}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          {t('shell.skipToContent')}
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
