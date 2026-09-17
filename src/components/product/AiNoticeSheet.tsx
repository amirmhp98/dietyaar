'use client';

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/UiComponents';
import { t } from '@/lib/t';

export type AiNoticeKindKey = 'PLAN' | 'MEAL_TEXT' | 'MEAL_PHOTO';

/**
 * AI-processing notice (product spec § 15): shown once per kind before the
 * first request, with a manual alternative. The parent decides when to show it.
 */
export function AiNoticeSheet({
  kind,
  open,
  onContinue,
  onManual,
  onOpenChange,
}: {
  kind: AiNoticeKindKey;
  open: boolean;
  onContinue: () => void;
  onManual: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const body = kind === 'PLAN' ? t('aiNotice.plan') : t('aiNotice.meal');
  const manual = kind === 'PLAN' ? t('aiNotice.setUpManually') : t('aiNotice.enterManually');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl" data-testid="ai-notice">
        <SheetHeader className="text-start">
          <SheetTitle>{t('aiNotice.title')}</SheetTitle>
          <SheetDescription className="text-base text-foreground">{body}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-4 gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={onManual}>
            {manual}
          </Button>
          <Button type="button" className="h-11" onClick={onContinue}>
            {t('aiNotice.continue')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
