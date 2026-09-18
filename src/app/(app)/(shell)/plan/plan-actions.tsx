'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { deletePlanAction, startPlanEditAction } from '@/actions/plan.actions';
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

/** My plan actions: Edit (→ review flow), Replace (→ Add your plan), Delete (typed confirmation). */
export function PlanActions({ planName }: { planName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const expected = planName?.trim() ?? '';
  const matches = expected === '' || typed.trim().toLowerCase() === expected.toLowerCase();

  function edit() {
    startTransition(async () => {
      const result = await startPlanEditAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push('/plan/review');
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePlanAction({ confirmation: expected === '' ? 'delete' : typed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(t('plan.page.deleted'));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="secondary"
          className="h-11"
          loading={pending}
          onClick={edit}
          data-testid="plan-edit"
        >
          <Pencil className="size-4" aria-hidden="true" />
          {t('plan.page.edit')}
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/plan/add" data-testid="plan-replace">
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('plan.page.replace')}
          </Link>
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
        data-testid="plan-delete"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t('plan.page.delete')}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {expected
                ? // FSI…PDI isolate the name so the question mark stays put beside RTL names.
                  t('plan.page.deleteTitle', { name: `\u2068${expected}\u2069` })
                : t('plan.page.deleteTitleUnnamed')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {expected ? t('plan.page.deleteBody') : t('plan.page.deleteBodyUnnamed')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {expected ? (
            <FormField label={t('plan.page.deleteConfirmLabel')}>
              <Input
                dir="auto"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-11"
              />
            </FormField>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('plan.page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!matches || pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {t('plan.page.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
