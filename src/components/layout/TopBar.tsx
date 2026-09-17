'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { SETTINGS_ITEM, isNavItemActive, pageTitleFor } from '@/lib/navigation';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

/** Page title on the start side, the profile button (→ Settings) on the end side. */
export function TopBar() {
  const pathname = usePathname();
  const title = pageTitleFor(pathname);
  const onSettings = isNavItemActive(SETTINGS_ITEM.href, pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-14">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact className="md:hidden" />
          <Logo className="hidden md:inline-flex" />
          <span className="truncate text-base font-semibold md:sr-only">{title}</span>
        </div>
        <Link
          href={SETTINGS_ITEM.href}
          aria-label={t('shell.profile')}
          aria-current={onSettings ? 'page' : undefined}
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            onSettings && 'bg-accent text-foreground',
          )}
        >
          <UserRound className="size-5" />
        </Link>
      </div>
    </header>
  );
}
