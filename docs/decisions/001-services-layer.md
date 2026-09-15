# 001 — Business logic lives in a framework-free services layer

**Decision.** All business rules live in `src/services/*.service.ts`. Services import Prisma, `env`
and `t()`, and nothing from `next/*` or React. Server actions are thin: authorise, validate with zod,
call a service, revalidate. Pages read through services and never through Prisma.

**Why.** It gives every rule exactly one home. A rule such as "deactivating a user revokes their
sessions" is implemented once and reached from the action, the page, a future API route and the tests.
Services are unit-testable with a mocked Prisma client and no HTTP context, which is where most of the
test value is. It also keeps agents honest: the ESLint layering rules (see 005) make it a lint error
to shortcut the layer.

**Consequences.** A little ceremony per feature (validation file, service, action). The
`npm run new:module` scaffold and the Users reference module keep that cost low. Data that a page needs
is fetched in the page through the service, not in the layout, because Next.js renders layouts and
pages in parallel.
