import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Session } from '@prisma/client';

faker.seed(42);

/** Full Prisma `Session` rows. `tokenHash` is a SHA-256 hex string like the real column. */
export const sessionFactory = Factory.define<Session>(({ sequence }) => ({
  id: `session-${sequence}`,
  userId: 'user-1',
  tokenHash: faker.string.hexadecimal({ length: 64, prefix: '', casing: 'lower' }),
  expiresAt: faker.date.future(),
  createdAt: faker.date.recent(),
}));
