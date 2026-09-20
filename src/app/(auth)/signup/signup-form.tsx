'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { UserPlus } from 'lucide-react';
import { signUpAction } from '@/actions/account.actions';
import { Button } from '@/components/UiComponents';
import { AuthField, AuthHeader, PasswordField } from '@/app/(auth)/auth-fields';
import { t } from '@/lib/t';

/** Sign up (design-scope screen 1): the same header as sign in, the no-recovery line under the password. */
export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <AuthHeader title={t('signup.title')} />

        <form action={formAction} className="space-y-5">
          <AuthField
            id="username"
            name="username"
            label={t('signup.username')}
            type="text"
            required
            autoComplete="username"
            autoFocus
            dir="auto"
            maxLength={30}
            placeholder={t('signup.usernamePlaceholder')}
          />
          <PasswordField
            id="password"
            name="password"
            label={t('signup.password')}
            required
            autoComplete="new-password"
            placeholder={t('signup.passwordPlaceholder')}
            hint={t('auth.noRecovery')}
          />

          {state?.error && (
            <div
              role="alert"
              data-testid="signup-error"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <Button type="submit" loading={isPending} className="w-full">
            <UserPlus aria-hidden="true" />
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
      </div>
    </div>
  );
}
