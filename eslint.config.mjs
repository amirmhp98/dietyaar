import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// ─── UI import boundary ─────────────────────────────────────────────────
// UI primitives may only be imported inside src/components/ui/**. App code
// goes through '@/components/UiComponents' or '@/components/ui/*' so RTL/LTR
// behaviour, direction and locale stay consistent.
const UI_PRIMITIVE_REGEX = '^(@radix-ui/|sonner$|react-day-picker(/|$)|input-otp$)';

// ─── Architecture layers ────────────────────────────────────────────────
// Type-only imports are always allowed, so a component can still write
// `import type { User } from '@prisma/client'`.
const layer = (files, patterns, ignores = []) => ({
  files,
  ignores,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      { patterns: patterns.map((p) => ({ ...p, allowTypeImports: true })) },
    ],
  },
});

const NO_PRISMA = {
  group: ['@/lib/prisma', '@prisma/client'],
  message:
    'UI never touches Prisma. Read through a service in a server component, write through a server action.',
};
const NO_SERVICES = {
  group: ['@/services/*'],
  message:
    'Only server files (page.tsx, layout.tsx, route.ts) may call services. Client components use server actions.',
};

/** Route-segment files Next.js always renders on the server. */
const SERVER_ROUTE_FILES =
  'src/app/**/{page,layout,template,loading,error,not-found,route,default}.{ts,tsx}';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: UI_PRIMITIVE_REGEX,
              message:
                "Import UI from '@/components/UiComponents' or '@/components/ui/*' so RTL/LTR and locale behaviour stay consistent.",
            },
          ],
        },
      ],
    },
  },

  // Shared components: no Prisma, no services (they get data via props or actions).
  layer(['src/components/**/*.{ts,tsx}'], [NO_PRISMA, NO_SERVICES]),
  // Client islands inside app/ (anything that is not a route-segment file): same rule.
  layer(['src/app/**/*.{ts,tsx}'], [NO_PRISMA, NO_SERVICES], [SERVER_ROUTE_FILES]),
  // Server route files may read through services, but never through Prisma directly.
  // (The health route is the one sanctioned exception: it pings the DB.)
  layer([SERVER_ROUTE_FILES], [NO_PRISMA], ['src/app/api/health/route.ts']),
  // services/ → framework-free business logic
  layer(
    ['src/services/**/*.ts'],
    [
      {
        group: ['next', 'next/*', 'react', 'react-dom', '@/components/*', '@/actions/*', '@/app/*'],
        message:
          'Services are framework-free. Cookies, redirects and revalidation belong in src/actions or src/lib/auth.',
      },
    ],
  ),
  // actions/ → thin: no UI, no direct Prisma
  layer(
    ['src/actions/**/*.ts'],
    [
      {
        group: ['@/components/*', '@/app/*'],
        message: 'Server actions return data; they never import UI.',
      },
      {
        group: ['@/lib/prisma'],
        message: 'Actions call services, not Prisma. Put the query in src/services.',
      },
    ],
  ),
  // lib/ → shared utilities only
  layer(
    ['src/lib/**/*.ts'],
    [
      {
        group: ['@/components/*', '@/actions/*', '@/app/*'],
        message: 'src/lib is the bottom layer: it cannot depend on UI or actions.',
      },
    ],
  ),

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    '.claude/**',
    '.beads/**',
  ]),
]);

export default eslintConfig;
