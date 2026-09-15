'use client';

import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Shield } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Ltr,
  Separator,
} from '@/components/UiComponents';
import { logoutAction } from '@/actions/auth.actions';
import { pageTitleFor } from '@/lib/navigation';
import { t } from '@/lib/t';
import { useAuth } from './AuthProvider';
import { useSidebar } from './SidebarContext';
import { ThemeToggle } from './ThemeToggle';

/** First letters of the first two words. Persian has no case, so no upper-casing. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
}

export function Header() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, setMobileOpen } = useSidebar();
  const user = useAuth();
  const title = pageTitleFor(pathname);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t('shell.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5 rtl:-scale-x-100" />
            ) : (
              <PanelLeftClose className="h-5 w-5 rtl:-scale-x-100" />
            )}
          </Button>

          <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="user-menu"
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted/50"
              >
                <div className="hidden text-start text-xs md:block">
                  <div className="flex items-center gap-1.5 font-medium">
                    {user.fullName}
                    {user.role === 'ADMIN' && (
                      <Badge
                        variant="outline"
                        className="h-4 border-primary/30 px-1.5 py-0 text-2xs text-primary"
                      >
                        {t('shell.adminBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    <Ltr>{user.username}</Ltr>
                  </div>
                </div>
                <Avatar className="h-9 w-9 border-2 border-background ring-1 ring-border">
                  <AvatarFallback className="text-xs font-semibold">
                    {initialsOf(user.fullName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    <Ltr>{user.username}</Ltr>
                  </p>
                  {user.role === 'ADMIN' && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Shield className="h-3 w-3" />
                      <span>{t('shell.adminRole')}</span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem asChild>
                  <button
                    type="submit"
                    className="w-full cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="me-2 h-4 w-4" />
                    {t('auth.logout')}
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
