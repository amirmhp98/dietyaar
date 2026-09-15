import type { ComponentType } from 'react';
import { Home, Layers, Users } from 'lucide-react';
import { t } from '@/lib/t';
import type { AuthUser } from '@/types/auth';

/**
 * Single source of truth for the app's navigation. The Sidebar renders it,
 * the Header derives page titles from it, and admin-only entries are hidden
 * for non-admins here rather than in each component.
 *
 * To add a page: add a NavItem (and its label to src/messages). To add a
 * section: add a NavGroup.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Renders smaller and lower-contrast (tooling, references). */
  secondary?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
  secondary?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: t('nav.group.dashboard'),
    items: [{ label: t('nav.home'), href: '/', icon: Home }],
  },
  {
    title: t('nav.group.tools'),
    secondary: true,
    items: [{ label: t('nav.components'), href: '/components', icon: Layers, secondary: true }],
  },
  {
    title: t('nav.group.admin'),
    adminOnly: true,
    items: [{ label: t('nav.users'), href: '/admin/users', icon: Users, adminOnly: true }],
  },
];

export function visibleNavGroups(user: Pick<AuthUser, 'role'>): NavGroup[] {
  const isAdmin = user.role === 'ADMIN';
  return NAV_GROUPS.filter((group) => isAdmin || !group.adminOnly).map((group) => ({
    ...group,
    items: group.items.filter((item) => isAdmin || !item.adminOnly),
  }));
}

export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Title for the header: longest matching nav item, or empty string. */
export function pageTitleFor(pathname: string): string {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const match = items
    .filter((item) => isNavItemActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? '';
}
