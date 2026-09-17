import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Content-free product analytics (product spec § 16): event names from the
 * allow-list, operational metadata only. Never meal names, nutrient values,
 * body measurements or uploaded text. Failures never break the caller.
 */
export const ANALYTICS_EVENTS = [
  'signup_completed',
  'onboarding_step',
  'onboarding_abandoned',
  'plan_import_started',
  'plan_import_finished',
  'plan_confirmed',
  'plan_deleted',
  'meal_draft_created',
  'analysis_succeeded',
  'analysis_failed',
  'meal_save_succeeded',
  'meal_save_failed',
  'meal_save_conflict',
  'meal_deleted',
  'reflection_opened',
  'reflection_updated',
  'reflection_fallback',
  'export_downloaded',
  'account_deletion_requested',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

type Scalar = string | number | boolean | null;

export async function recordEvent(
  name: AnalyticsEventName,
  properties: Record<string, Scalar> = {},
  userId: string | null = null,
): Promise<void> {
  if (!(ANALYTICS_EVENTS as readonly string[]).includes(name)) return;
  try {
    await prisma.analyticsEvent.create({ data: { name, properties, userId } });
  } catch (error) {
    logger.warn({ err: error, event: name }, 'analytics event not recorded');
  }
}
