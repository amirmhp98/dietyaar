'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { PREFERENCE_COOKIE_MAX_AGE, SIDEBAR_COLLAPSED_COOKIE } from '@/lib/preferences';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Collapsed state is persisted in a cookie so the server layout can render
 * the correct width on the first paint — no hydration mismatch, no flicker.
 */
export function SidebarProvider({
  defaultCollapsed = false,
  children,
}: {
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
    setIsCollapsed(next);
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
