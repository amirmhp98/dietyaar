import type { RuleObservation } from '@/lib/rubric/types';
import { t } from '@/lib/t';

/** One status line per rule observation (product spec § 8 rules; keys owned by the day module). */
export function ruleStatus(observation: RuleObservation): string {
  const count = observation.count ?? 0;
  const required = observation.required ?? 0;
  switch (observation.status) {
    case 'PROGRESS':
      return t('day.rule.progress', { count, required });
    case 'MET':
      return t('day.rule.met', { count, required });
    case 'NOT_MET':
      return t('day.rule.notMet', { count, required });
    case 'INCOMPLETE':
      return t('day.rule.incomplete');
    case 'FLAGGED':
      return t('day.rule.flagged', {
        names: observation.hits.map((h) => h.originalName).join(', '),
      });
    case 'NOTE':
      return t('day.rule.note');
  }
}
