'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_TABS, isNavItemActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/** Three primary tabs, 44 px targets, safe-area padding (product spec § 4, § 12). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex h-16 max-w-3xl items-stretch md:h-14 md:justify-center md:gap-2">
        {PRIMARY_TABS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-3 text-xs font-medium transition-colors md:flex-row md:gap-2 md:px-4 md:text-sm',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('size-5', active && 'text-primary')} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
