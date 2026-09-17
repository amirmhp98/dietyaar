import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('migrations', () => {
  it('created the product tables with timestamptz columns and citext usernames', async () => {
    const rows = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, COALESCE(NULLIF(udt_name, ''), data_type) AS data_type FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('createdAt', 'usernameLower')`;
    const byName = Object.fromEntries(rows.map((row) => [row.column_name, row.data_type]));
    expect(byName.createdAt).toBe('timestamptz');
    expect(byName.usernameLower).toBe('citext');
  });

  it('every migration file starts with lock_timeout (tech spec § 13)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = 'prisma/migrations';
    const files = readdirSync(dir).filter((name) => /^\d{4}_/.test(name) && name !== '0001_init');
    for (const name of files) {
      const sql = readFileSync(`${dir}/${name}/migration.sql`, 'utf8');
      expect(
        sql
          .trimStart()
          .replace(/^--.*\n/gm, '')
          .trimStart(),
      ).toMatch(/^SET lock_timeout/);
    }
  });
});
