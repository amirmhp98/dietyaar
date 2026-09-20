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
import { Disclosure } from '@/components/product/Disclosure';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

/**
 * Privacy & data (design-scope screen 8): the AI-processing note behind a
 * disclosure, export as an outline action, and "Delete account" as a
 * text-destructive ghost action with the typed confirmation (decision 025).
 */
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
    <div className="space-y-3">
      <Disclosure label={t('settings.privacy.aiIntro')} testId="privacy-ai-notice">
        <Surface variant="note" padding="sm">
          <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">
            <li>{t('aiNotice.plan')}</li>
            <li>{t('aiNotice.meal')}</li>
            <li>{t('settings.privacy.aiReflection')}</li>
          </ul>
        </Surface>
      </Disclosure>
      <div className="space-y-1">
        <Button asChild variant="outline" className="w-full">
          <a href="/api/export" download>
            <Download aria-hidden="true" />
            {t('settings.privacy.export')}
          </a>
        </Button>
        <p className="px-1 text-xs text-muted-foreground">{t('settings.privacy.exportHint')}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="w-full text-destructive-ink hover:text-destructive-ink"
        onClick={() => setOpen(true)}
        data-testid="delete-account"
      >
        <Trash2 aria-hidden="true" />
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
