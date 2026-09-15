#!/usr/bin/env node
/**
 * Scaffolds a feature module that follows the reference Users module:
 *
 *   npm run new:module invoice
 *
 * creates
 *   src/lib/validations/invoice.ts        zod schemas (+ message keys to add)
 *   src/services/invoice.service.ts       framework-free business logic
 *   src/actions/invoice.actions.ts        thin server actions
 *   src/app/invoices/page.tsx             server page (reads through the service)
 *   src/app/invoices/invoice-list.tsx     client island
 *   src/__tests__/services/invoice.service.test.ts
 *
 * and inserts placeholder message keys into the project's dictionary in
 * src/messages/. Nothing is overwritten. After running: add the Prisma model,
 * run `npm run db:migrate`, translate the placeholders, and wire the route
 * into src/lib/navigation.ts.
 */
import fs from 'node:fs';
import path from 'node:path';

const raw = process.argv[2];
if (!raw || !/^[a-z][a-z0-9-]*$/.test(raw)) {
  console.error('Usage: npm run new:module <kebab-name>   (e.g. invoice, purchase-order)');
  process.exit(1);
}

const kebab = raw; // invoice, purchase-order
const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // purchaseOrder
const pascal = camel[0].toUpperCase() + camel.slice(1); // PurchaseOrder
const plural = kebab.endsWith('s') ? kebab : `${kebab}s`; // route segment
const root = path.resolve(import.meta.dirname, '..');

const files = {
  [`src/lib/validations/${kebab}.ts`]: `import { z } from 'zod';
import { t } from '@/lib/t';

/** Shared by the server action (runtime validation) and the client form (zodResolver). */
export const ${camel}IdSchema = z.string().min(1, t('validation.invalid'));

export const create${pascal}Schema = z.object({
  name: z.string().trim().min(1, t('validation.required')),
});
export type Create${pascal}Input = z.infer<typeof create${pascal}Schema>;
`,

  [`src/services/${kebab}.service.ts`]: `import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';
import type { Create${pascal}Input } from '@/lib/validations/${kebab}';

/**
 * ${pascal} service. Framework-free: no next/*, no React. Throw ServiceError for
 * expected failures; let unexpected errors propagate to the action.
 *
 * TODO: add the \`${pascal}\` model to prisma/schema.prisma and run \`npm run db:migrate\`.
 */

export const ${camel.toUpperCase()}_LIST_SELECT = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.${pascal}Select;

export type ${pascal}ListItem = Prisma.${pascal}GetPayload<{ select: typeof ${camel.toUpperCase()}_LIST_SELECT }>;

export function list${pascal}s(): Promise<${pascal}ListItem[]> {
  return prisma.${camel}.findMany({ orderBy: { createdAt: 'desc' }, select: ${camel.toUpperCase()}_LIST_SELECT });
}

export async function create${pascal}(input: Create${pascal}Input): Promise<${pascal}ListItem> {
  return prisma.${camel}.create({ data: input, select: ${camel.toUpperCase()}_LIST_SELECT });
}

export async function delete${pascal}(id: string): Promise<void> {
  const existing = await prisma.${camel}.findUnique({ where: { id } });
  if (!existing) throw new ServiceError(t('errors.notFound'), '${camel.toUpperCase()}_NOT_FOUND');
  await prisma.${camel}.delete({ where: { id } });
}
`,

  [`src/actions/${kebab}.actions.ts`]: `'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, fromError, fromZodError, ok } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import { create${pascal}Schema, ${camel}IdSchema } from '@/lib/validations/${kebab}';
import * as ${camel}s from '@/services/${kebab}.service';

const PATH = '/${plural}';

export async function create${pascal}Action(input: unknown): Promise<ActionResult> {
  await requireAuth();
  const parsed = create${pascal}Schema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await ${camel}s.create${pascal}(parsed.data);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}

export async function delete${pascal}Action(id: unknown): Promise<ActionResult> {
  await requireAuth();
  const parsedId = ${camel}IdSchema.safeParse(id);
  if (!parsedId.success) return fromZodError(parsedId.error);

  try {
    await ${camel}s.delete${pascal}(parsedId.data);
    revalidatePath(PATH);
    return ok();
  } catch (error) {
    return fromError(error);
  }
}
`,

  [`src/app/${plural}/page.tsx`]: `import { requireAuth } from '@/lib/auth';
import { t } from '@/lib/t';
import { list${pascal}s } from '@/services/${kebab}.service';
import { ${pascal}List } from './${kebab}-list';

/** Server component: guards access, reads through the service, renders client islands. */
export default async function ${pascal}sPage() {
  await requireAuth();
  const items = await list${pascal}s();

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('${camel}s.title')}</h2>
      <${pascal}List items={items} />
    </div>
  );
}
`,

  [`src/app/${plural}/${kebab}-list.tsx`]: `'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, toast } from '@/components/UiComponents';
import { delete${pascal}Action } from '@/actions/${kebab}.actions';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/t';
import type { ${pascal}ListItem } from '@/services/${kebab}.service';

export function ${pascal}List({ items }: { items: ${pascal}ListItem[] }) {
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const result = await delete${pascal}Action(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {t('${camel}s.empty')}
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('${camel}s.delete')}
            loading={isPending}
            onClick={() => remove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
`,

  [`src/__tests__/services/${kebab}.service.test.ts`]: `import { describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { create${pascal}, delete${pascal}, list${pascal}s } from '@/services/${kebab}.service';

resetPrismaMock();

describe('${kebab}.service', () => {
  it('lists newest first', async () => {
    prismaMock.${camel}.findMany.mockResolvedValue([]);
    await list${pascal}s();
    expect(prismaMock.${camel}.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('creates with the validated input', async () => {
    prismaMock.${camel}.create.mockResolvedValue({ id: '1', name: 'x', createdAt: new Date() } as never);
    await create${pascal}({ name: 'x' });
    expect(prismaMock.${camel}.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'x' } }),
    );
  });

  it('delete throws a ServiceError for an unknown id', async () => {
    prismaMock.${camel}.findUnique.mockResolvedValue(null);
    await expect(delete${pascal}('nope')).rejects.toMatchObject({ code: '${camel.toUpperCase()}_NOT_FOUND' });
  });
});
`,
};

for (const [rel, content] of Object.entries(files)) {
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) {
    console.log(`skip    ${rel} (exists)`);
    continue;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  console.log(`created ${rel}`);
}

// Message keys: inserted before the "Error boundary" block of every dictionary
// present in src/messages (a project has one; the boilerplate itself has both).
const MESSAGE_MARKER = '  // ── Error boundary';
function addMessages(file, entries) {
  const abs = path.join(root, file);
  const src = fs.readFileSync(abs, 'utf8');
  if (src.includes(`'${camel}s.title'`)) {
    console.log(`skip    ${file} (keys exist)`);
    return;
  }
  const block =
    `  // ── ${pascal}s ${'─'.repeat(Math.max(1, 46 - pascal.length))}\n` +
    entries.map(([k, v]) => `  '${k}': '${v}',`).join('\n') +
    '\n\n';
  const at = src.indexOf(MESSAGE_MARKER);
  if (at < 0) throw new Error(`marker not found in ${file}`);
  fs.writeFileSync(abs, src.slice(0, at) + block + src.slice(at));
  console.log(`updated ${file}`);
}
const PLACEHOLDERS = {
  fa: [
    [`${camel}s.title`, `${pascal}s`],
    [`${camel}s.empty`, 'موردی ثبت نشده است.'],
    [`${camel}s.delete`, 'حذف'],
  ],
  en: [
    [`${camel}s.title`, `${pascal}s`],
    [`${camel}s.empty`, 'Nothing here yet.'],
    [`${camel}s.delete`, 'Delete'],
  ],
};
const dictionaries = Object.keys(PLACEHOLDERS)
  .map((id) => `src/messages/${id}.ts`)
  .filter((file) => fs.existsSync(path.join(root, file)));
if (dictionaries.length === 0) {
  console.error('No dictionary found in src/messages/ (expected fa.ts or en.ts).');
  process.exit(1);
}
for (const file of dictionaries) {
  addMessages(file, PLACEHOLDERS[path.basename(file, '.ts')]);
}

console.log(`
Next steps for "${kebab}":
  1. prisma/schema.prisma → add:
       model ${pascal} {
         id        String   @id @default(cuid())
         name      String
         createdAt DateTime @default(now())
         updatedAt DateTime @updatedAt
         @@map("${plural.replace(/-/g, '_')}")
       }
     then: npm run db:migrate -- --name add-${kebab}
  2. ${dictionaries.join(', ')} → translate the '${camel}s.*' placeholders
  3. src/lib/navigation.ts → add { label: t('${camel}s.title'), href: '/${plural}', icon: ... }
  4. npm run lint:all && npm run test
`);
