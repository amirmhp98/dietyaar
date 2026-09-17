import type { ComponentType } from 'react';
import { CalendarDays, ClipboardList, Layers, Settings, Sun, Users } from 'lucide-react';
import { t } from '@/lib/t';
import type { AuthUser } from '@/types/auth';

/**
 * Single source of truth for the product navigation (product spec § 4):
 * three primary tabs, a settings entry behind the profile button, and the
 * admin tools reachable from Settings › Tools.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

export const PRIMARY_TABS: NavItem[] = [
  { label: t('nav.today'), href: '/today', icon: Sun },
  { label: t('nav.history'), href: '/history', icon: CalendarDays },
  { label: t('nav.plan'), href: '/plan', icon: ClipboardList },
];

export const SETTINGS_ITEM: NavItem = {
  label: t('nav.settings'),
  href: '/settings',
  icon: Settings,
};

export const ADMIN_ITEMS: NavItem[] = [
  { label: t('nav.users'), href: '/admin/users', icon: Users, adminOnly: true },
  { label: t('nav.components'), href: '/components', icon: Layers, adminOnly: true },
];

export const ALL_ITEMS: NavItem[] = [
  ...PRIMARY_TABS,
  SETTINGS_ITEM,
  ADMIN_ITEMS[0],
  ADMIN_ITEMS[1],
];

export function visibleAdminItems(user: Pick<AuthUser, 'role'>): NavItem[] {
  return user.role === 'ADMIN' ? ADMIN_ITEMS : [];
}

export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Title for the top bar: longest matching nav item, or empty string. */
export function pageTitleFor(pathname: string): string {
  const match = ALL_ITEMS.filter((item) => isNavItemActive(item.href, pathname)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.label ?? '';
}
