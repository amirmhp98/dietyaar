import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';

/** Placeholder until phase 7. */
export default async function TodayPage() {
  await requireOnboarded();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{t('nav.today')}</h1>
    </div>
  );
}
