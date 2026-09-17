'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { changePasswordAction } from '@/actions/account.actions';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  toast,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validations/account';

export function AccountSection() {
  const [open, setOpen] = useState(false);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePasswordAction(values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ChangePasswordInput, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success(t('settings.account.passwordChanged'));
    form.reset();
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" />
        {t('settings.account.changePassword')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('settings.account.changePassword')}</DialogTitle>
            <DialogDescription>
              {t('settings.account.changePassword.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              label={t('settings.account.currentPassword')}
              required
              error={errors.currentPassword?.message}
            >
              <Input
                type="password"
                autoComplete="current-password"
                className="h-11"
                {...form.register('currentPassword')}
              />
            </FormField>
            <FormField
              label={t('settings.account.newPassword')}
              required
              error={errors.newPassword?.message}
            >
              <Input
                type="password"
                autoComplete="new-password"
                className="h-11"
                {...form.register('newPassword')}
              />
            </FormField>
            <Button type="submit" className="h-11 w-full" loading={isSubmitting}>
              {t('settings.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
