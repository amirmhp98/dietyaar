'use client';

import { LogOut } from 'lucide-react';
import { logoutAction } from '@/actions/auth.actions';
import { Button } from '@/components/UiComponents';
import { t } from '@/lib/t';

/** Clears per-account browser drafts before the session is revoked (product spec § 15). */
export function LogoutButton() {
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        try {
          Object.keys(sessionStorage)
            .filter((key) => key.startsWith('composer:') || key.startsWith('reflection-'))
            .forEach((key) => sessionStorage.removeItem(key));
        } catch {
          // storage unavailable
        }
      }}
    >
      <Button type="submit" variant="outline" className="h-11 w-full" data-testid="logout">
        <LogOut className="size-4" />
        {t('auth.logout')}
      </Button>
    </form>
  );
}
