'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { signUpAction } from '@/actions/account.actions';
import { Button, Input } from '@/components/UiComponents';
import { Logo } from '@/components/layout/Logo';
import { APP_NAME } from '@/lib/app-config';
import { t } from '@/lib/t';

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10" />
          <h1 className="text-lg font-semibold text-foreground">{t('signup.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('signup.tagline')}</p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              {t('signup.username')}
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              dir="auto"
              maxLength={30}
              placeholder={t('signup.usernamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {t('signup.password')}
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="pe-10"
                placeholder={t('signup.passwordPlaceholder')}
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
            <p className="text-xs text-muted-foreground">{t('auth.noRecovery')}</p>
          </div>

          {state?.error && (
            <div
              role="alert"
              data-testid="signup-error"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <Button type="submit" loading={isPending} className="h-11 w-full">
            <UserPlus className="h-4 w-4" />
            {isPending ? t('signup.submitting') : t('signup.submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('signup.haveAccount')}{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('signup.loginLink')}
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground/50">{APP_NAME}</p>
      </div>
    </div>
  );
}
