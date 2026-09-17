import { requireOnboarded } from '@/lib/auth';
import { t } from '@/lib/t';

/** Placeholder until its phase. */
export default async function Page() {
  await requireOnboarded();
  return <h1 className="text-2xl font-semibold">{t('nav.plan')}</h1>;
}
