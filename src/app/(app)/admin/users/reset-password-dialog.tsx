'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { resetPasswordAction } from '@/actions/user.actions';
import { t } from '@/lib/t';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/user';
import type { UserListItem } from '@/services/user.service';

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserListItem | null;
  onClose: () => void;
}) {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (user) form.reset({ password: '' });
  }, [user, form]);

  async function onSubmit(values: ResetPasswordInput) {
    if (!user) return;
    const result = await resetPasswordAction(user.id, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t('users.toast.passwordReset'));
    onClose();
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.reset.title')}</DialogTitle>
          <DialogDescription>
            {t('users.reset.description', { name: user?.fullName ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label={t('users.field.newPassword')} required error={errors.password?.message}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              autoFocus
              {...form.register('password')}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('users.action.cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('users.action.reset')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
