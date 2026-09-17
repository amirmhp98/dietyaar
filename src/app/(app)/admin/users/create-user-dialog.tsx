'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  toast,
} from '@/components/UiComponents';
import { createUserAction } from '@/actions/user.actions';
import { t } from '@/lib/t';
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user';
import { UserRoleSelect } from './user-role-select';

const DEFAULTS: CreateUserInput = { username: '', password: '', fullName: '', role: 'USER' };

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULTS,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CreateUserInput) {
    const result = await createUserAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t('users.toast.created'));
    form.reset(DEFAULTS);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(DEFAULTS);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t('users.action.new')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.create.title')}</DialogTitle>
          <DialogDescription>{t('users.create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label={t('users.field.fullName')} error={errors.fullName?.message}>
            <Input autoComplete="off" autoFocus dir="auto" {...form.register('fullName')} />
          </FormField>

          <FormField
            label={t('users.field.username')}
            required
            error={errors.username?.message}
            helperText={t('users.field.usernameHint')}
          >
            <Input dir="ltr" autoComplete="off" {...form.register('username')} />
          </FormField>

          <FormField label={t('users.field.password')} required error={errors.password?.message}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              {...form.register('password')}
            />
          </FormField>

          <FormField
            id="create-user-role"
            label={t('users.field.role')}
            required
            error={errors.role?.message}
          >
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <UserRoleSelect
                  id="create-user-role"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('users.action.cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('users.action.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
