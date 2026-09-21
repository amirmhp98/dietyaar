'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/UiComponents';
import { Logo } from '@/components/layout/Logo';
import { t } from '@/lib/t';

/** Logo, the page title in the display face, and the one value line (design-scope screen 1). */
export function AuthHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Logo className="h-10" />
      <h1 className="font-display text-2xl font-semibold leading-tight text-foreground">{title}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">{t('auth.tagline')}</p>
    </div>
  );
}

/** The action's error above the submit button. */
export function AuthError({ error, testId }: { error: string | undefined; testId: string }) {
  return error ? (
    <div
      role="alert"
      data-testid={testId}
      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {error}
    </div>
  ) : null;
}

/** A labelled 44 px input; the label binds to the input directly, so tests and assistive tech find it. */
export function AuthField({
  id,
  label,
  ...input
}: { id: string; label: string } & ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} className="h-11" {...input} />
    </div>
  );
}

/** Password with the show/hide toggle inside the field. */
export function PasswordField({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & Omit<ComponentProps<typeof Input>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} className="h-11 pe-12" {...input} />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          className="absolute end-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
          tabIndex={-1}
        >
          {show ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
