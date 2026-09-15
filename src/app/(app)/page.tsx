import { Card, CardContent, CardHeader, CardTitle } from '@/components/UiComponents';
import { requireAuth } from '@/lib/auth';
import { t } from '@/lib/t';

export default async function HomePage() {
  const user = await requireAuth();

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('home.title')}</h2>
        <p className="text-muted-foreground mt-1">{t('home.welcome', { name: user.fullName })}</p>
      </div>

      {/* Placeholder Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('home.gettingStarted.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('home.gettingStarted.description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
