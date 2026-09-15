import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { User } from '@prisma/client';

faker.seed(42);

/** Full Prisma `User` rows for mocking `prisma.user.*` results. */
export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: `user-${sequence}`,
  username: `user${sequence}`,
  passwordHash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceho',
  fullName: faker.person.fullName(),
  role: 'USER',
  isActive: true,
  lastLoginAt: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
}));
