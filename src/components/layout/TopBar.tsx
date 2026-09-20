'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { PRIMARY_TABS, SETTINGS_ITEM, isNavItemActive, pageTitleFor } from '@/lib/navigation';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

/**
 * The one header row (design.md "Product UI", decision 025): the page title
 * in the display face on phones, the three primary tabs on wider screens
 * (where the active tab is the title), and the profile button to Settings.
 * The title is the page's h1, so product pages do not repeat it beneath.
 */
export function TopBar() {
  const pathname = usePathname();
  const title = pageTitleFor(pathname);
  const onSettings = isNavItemActive(SETTINGS_ITEM.href, pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
          <Logo compact className="md:hidden" />
          <Logo className="hidden md:inline-flex" />
          <h1 className="min-w-0 truncate font-display text-lg font-semibold md:sr-only">
            {title}
          </h1>
        </div>
        <nav aria-label={t('nav.primary')} className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-1">
            {PRIMARY_TABS.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                      active
                        ? 'bg-tint-2 text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href={SETTINGS_ITEM.href}
          aria-label={t('shell.profile')}
          aria-current={onSettings ? 'page' : undefined}
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            onSettings && 'bg-tint-2 text-foreground',
          )}
        >
          <UserRound className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
