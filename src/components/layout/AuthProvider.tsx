'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AuthUser } from '@/types/auth';

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) throw new Error('useAuth must be used within AuthProvider with a valid user');
  return user;
}

export function useAuthOptional(): AuthUser | null {
  return useContext(AuthContext);
}
