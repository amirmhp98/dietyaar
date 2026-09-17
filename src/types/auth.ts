import type { OnboardingStep, UserRole } from '@prisma/client';

/** The safe, client-shareable projection of a user. Never includes passwordHash. */
export type AuthUser = {
  id: string;
  username: string;
  /** Optional: sign-up collects no name. Greetings use Profile.displayName, then username. */
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  /** Resume pointer for onboarding; product pages require `DONE`. */
  onboardingStep: OnboardingStep;
};
