'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn } from 'lucide-react';
import { loginAction } from '@/actions/auth.actions';
import { Button } from '@/components/UiComponents';
import { AuthError, AuthField, AuthHeader, PasswordField } from '@/app/(auth)/auth-fields';
import { t } from '@/lib/t';

/** Sign in (design-scope screen 1): the value line under the logo, two fields, one filled button. */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <AuthHeader title={t('auth.login.title')} />

        <form action={formAction} className="space-y-5">
          <AuthField
            id="username"
            name="username"
            label={t('auth.login.username')}
            type="text"
            required
            autoComplete="username"
            autoFocus
            dir="auto"
            placeholder={t('auth.login.usernamePlaceholder')}
          />
          <PasswordField
            id="password"
            name="password"
            label={t('auth.login.password')}
            required
            autoComplete="current-password"
            placeholder={t('auth.login.passwordPlaceholder')}
          />

          <AuthError error={state?.error} testId="login-error" />

          <Button type="submit" loading={isPending} className="w-full">
            <LogIn aria-hidden="true" />
            {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.login.noAccount')}{' '}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.login.signupLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
