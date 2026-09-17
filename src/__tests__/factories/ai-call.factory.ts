import { Factory } from 'fishery';
import type { AiCall } from '@prisma/client';

/** Full Prisma `AiCall` rows (a completed MEAL_TEXT call by default). */
export const aiCallFactory = Factory.define<AiCall>(({ sequence }) => ({
  id: `ai-call-${sequence}`,
  userId: `user-${sequence}`,
  kind: 'MEAL_TEXT',
  localDate: '2026-09-17',
  providerModel: 'deepseek-flash',
  inputRevision: null,
  durationMs: 1200,
  promptTokens: 900,
  completionTokens: 300,
  outcome: 'OK',
  attemptsJson: [{ model: 'deepseek-flash', durationMs: 1200, outcome: 'OK' }],
  createdAt: new Date('2026-09-17T08:00:00Z'),
  updatedAt: new Date('2026-09-17T08:00:02Z'),
}));
