import type { ReactNode } from 'react';

/** Onboarding renders bare: no tabs, no Log meal button (design-scope screen 2). */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
