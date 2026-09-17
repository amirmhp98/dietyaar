import { describe, expect, it } from 'vitest';
import { isNavItemActive, pageTitleFor, PRIMARY_TABS, visibleAdminItems } from '@/lib/navigation';
import { sessionCookieOptions } from '@/lib/session-cookie';
import { t } from '@/lib/t';

describe('navigation', () => {
  it('has the three primary tabs and hides admin tools from plain users', () => {
    expect(PRIMARY_TABS.map((i) => i.href)).toEqual(['/today', '/history', '/plan']);
    expect(visibleAdminItems({ role: 'USER' })).toEqual([]);
    expect(visibleAdminItems({ role: 'ADMIN' }).map((i) => i.href)).toContain('/admin/users');
  });

  it('matches the home item only on the exact path', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/', '/admin/users')).toBe(false);
    expect(isNavItemActive('/admin/users', '/admin/users/123')).toBe(true);
    expect(isNavItemActive('/admin', '/administration')).toBe(false);
  });

  it('derives the header title from the longest matching item', () => {
    expect(pageTitleFor('/today')).toBe(t('nav.today'));
    expect(pageTitleFor('/admin/users')).toBe(t('nav.users'));
    expect(pageTitleFor('/nothing-here')).toBe('');
  });
});

describe('sessionCookieOptions', () => {
  it('is http-only, lax and scoped to the whole site', () => {
    const expires = new Date();
    expect(sessionCookieOptions(expires)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
  });
});
