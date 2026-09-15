import Link from 'next/link';
import { Button } from '@/components/UiComponents';
import { Home } from 'lucide-react';
import { t } from '@/lib/t';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-1">
        <h1 className="text-6xl font-bold text-muted-foreground/30">{t('notFound.code')}</h1>
        <h2 className="text-xl font-bold">{t('notFound.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{t('notFound.description')}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">
          <Home className="h-4 w-4" />
          {t('notFound.backHome')}
        </Link>
      </Button>
    </div>
  );
}
