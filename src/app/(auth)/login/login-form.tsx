'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginAction } from '@/actions/auth.actions';
import { Button, Input } from '@/components/UiComponents';
import { Logo } from '@/components/layout/Logo';
import { APP_NAME } from '@/lib/app-config';
import { t } from '@/lib/t';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo className="h-10" />
          <h1 className="text-lg font-semibold text-foreground">{t('auth.login.title')}</h1>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              {t('auth.login.username')}
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              dir="auto"
              placeholder={t('auth.login.usernamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {t('auth.login.password')}
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="pe-10"
                placeholder={t('auth.login.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={
                  showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                }
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {state?.error && (
            <div
              role="alert"
              data-testid="login-error"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <Button type="submit" loading={isPending} className="h-11 w-full">
            <LogIn className="h-4 w-4" />
            {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground/50">{APP_NAME}</p>
      </div>
    </div>
  );
}
