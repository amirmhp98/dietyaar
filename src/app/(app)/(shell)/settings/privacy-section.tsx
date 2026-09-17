'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { requestAccountDeletionAction } from '@/actions/account.actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  FormField,
  Input,
  toast,
} from '@/components/UiComponents';
import { t } from '@/lib/t';

export function PrivacySection({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  function confirmDelete() {
    startTransition(async () => {
      const result = await requestAccountDeletionAction({ username: typed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        sessionStorage.clear();
      } catch {
        // storage unavailable
      }
      toast.success(t('settings.privacy.deleted'));
      router.replace('/login');
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">{t('settings.privacy.aiIntro')}</p>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{t('aiNotice.plan')}</li>
          <li>{t('aiNotice.meal')}</li>
          <li>{t('settings.privacy.aiReflection')}</li>
        </ul>
      </div>
      <Button asChild variant="outline" className="h-11 w-full">
        <a href="/api/export" download>
          <Download className="size-4" />
          {t('settings.privacy.export')}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">{t('settings.privacy.exportHint')}</p>
      <Button
        type="button"
        variant="destructive"
        className="h-11 w-full"
        onClick={() => setOpen(true)}
        data-testid="delete-account"
      >
        <Trash2 className="size-4" />
        {t('settings.privacy.delete')}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.privacy.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.privacy.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField label={t('settings.privacy.deleteConfirmLabel')}>
            <Input
              dir="auto"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-11"
            />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!matches || pending}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {t('settings.privacy.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
