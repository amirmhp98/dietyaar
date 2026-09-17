import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { requireAuth } from '@/lib/auth';

/**
 * Authenticated area: verifies the session and nothing else. The product
 * shell lives in the nested `(shell)` group; `onboarding/` renders bare.
 * Pages still call requireAuth()/requireOnboarded() themselves because
 * Next.js renders layouts and pages in parallel (the call is cached).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  return <AuthProvider user={user}>{children}</AuthProvider>;
}
