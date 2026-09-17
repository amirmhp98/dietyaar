import { registerTask } from '@/services/jobs/registry';

/** STUB — replaced by its owning agent. */
registerTask({
  name: 'purge',
  everyMs: 60 * 60 * 1000,
  run: async () => {},
});
