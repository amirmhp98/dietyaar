import type { ComponentType } from 'react';
import { CalendarDays, ClipboardList, Layers, Settings, Sun, Users } from 'lucide-react';
import { t } from '@/lib/t';
import type { AuthUser } from '@/types/auth';

/**
 * Single source of truth for the product navigation (product spec § 4):
 * three primary tabs with Today in the middle (decision 9), a settings entry
 * behind the profile button, and the admin tools reachable from Settings › Tools.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

export const PRIMARY_TABS: NavItem[] = [
  { label: t('nav.history'), href: '/history', icon: CalendarDays },
  { label: t('nav.today'), href: '/today', icon: Sun },
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

/** Routes reached from a page rather than a tab: a top-bar title, no nav entry. */
const DETAIL_PAGES: Array<Pick<NavItem, 'label' | 'href'>> = [
  { label: t('meal.details.title'), href: '/meals' },
];

export function visibleAdminItems(user: Pick<AuthUser, 'role'>): NavItem[] {
  return user.role === 'ADMIN' ? ADMIN_ITEMS : [];
}

export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Title for the top bar: longest matching nav item or detail page, or empty string. */
export function pageTitleFor(pathname: string): string {
  const match = [...ALL_ITEMS, ...DETAIL_PAGES]
    .filter((item) => isNavItemActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? '';
}

/**
 * Flows with a filled primary of their own (Add your plan, Review your plan):
 * the floating button would be a second emerald on the viewport (decision 025).
 */
const FLOW_PAGES = ['/plan/add', '/plan/review'];

/**
 * A detail page shows its record and its own actions, and a plan flow has
 * its own primary; the floating Log meal button would cover or compete with them.
 */
export function showsLogMealButton(pathname: string): boolean {
  return ![...DETAIL_PAGES.map((page) => page.href), ...FLOW_PAGES].some((href) =>
    isNavItemActive(href, pathname),
  );
}
