import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireOnboarded } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { photoUrl } from '@/lib/photo-url';
import { localDateFor } from '@/lib/time/local-date';
import { APP_TIME_ZONE } from '@/lib/time/zone';
import { getDayView } from '@/services/day-view.service';
import { getMeal, type MealView } from '@/services/meal.service';
import { MealDetails } from './meal-details';

export const dynamic = 'force-dynamic';

/**
 * Meal details (design-scope screen 5): the saved meal, its plan link and
 * the comparison Today computed for its slot. Photos get account-bound URLs
 * from the raw session token (decision 016).
 */
export default async function MealDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboarded();
  let meal: MealView;
  try {
    meal = await getMeal(user.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const now = new Date();
  const [day, cookieStore] = await Promise.all([
    getDayView(user.id, meal.localDate, now),
    cookies(),
  ]);
  const rawToken = cookieStore.get('session')?.value ?? '';
  const slotView = day.view.slots.find((s) => s.mealIds.includes(meal.id)) ?? null;

  return (
    <MealDetails
      meal={meal}
      slotView={slotView}
      slots={day.view.slots.map((s) => s.slot)}
      photos={meal.uploads.map((u) => ({ id: u.id, url: photoUrl(u.id, rawToken) }))}
      today={localDateFor(now, APP_TIME_ZONE)}
    />
  );
}
