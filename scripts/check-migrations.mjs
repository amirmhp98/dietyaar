#!/usr/bin/env node
/**
 * Migration safety gate (tech spec § 13, § 15; decision 014).
 *
 * For every `prisma/migrations/<dir>/migration.sql` added or changed against a
 * base ref (`$MIGRATION_BASE_REF`, default `origin/main`; falls back to every
 * migration when the ref is unknown, e.g. on the first push of a branch):
 *   - fail on `DROP ...` or `ALTER ... TYPE ...` statements unless the file
 *     carries a `-- decision:` comment naming the record that allows it;
 *   - fail when a product migration (anything but the boilerplate 0001) does
 *     not begin with `SET lock_timeout` so a blocked rollout fails fast.
 *
 * Usage: node scripts/check-migrations.mjs   (npm run check:migrations)
 * Exit 0 when clean, 1 with one line per finding.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const migrationsDir = join(root, 'prisma', 'migrations');
const baseRef = process.env.MIGRATION_BASE_REF ?? 'origin/main';

/** Lines that are only SQL comments never count as statements. */
function stripComments(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

export function findViolations(sql, { boilerplate }) {
  const findings = [];
  const code = stripComments(sql);
  const hasDecision = /--\s*decision:\s*\S+/i.test(sql);

  const statements = code
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const destructive = [
    { name: 'DROP', pattern: /^DROP\s+/i },
    // ALTER TABLE ... ALTER COLUMN ... TYPE / SET DATA TYPE, and ALTER TYPE ... (enum changes)
    { name: 'ALTER ... TYPE', pattern: /^ALTER\s+(?:TYPE\b|TABLE\b[\s\S]*\bTYPE\b)/i },
  ];
  for (const { name, pattern } of destructive) {
    if (statements.some((statement) => pattern.test(statement)) && !hasDecision) {
      findings.push(`${name} statement without a "-- decision: <record>" comment`);
    }
  }

  if (!boilerplate) {
    const firstStatement = statements[0];
    if (!firstStatement || !/^SET\s+lock_timeout\b/i.test(firstStatement)) {
      findings.push("does not start with SET lock_timeout = '5s' (tech spec § 13)");
    }
  }
  return findings;
}

function changedMigrationFiles() {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .filter((f) => /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(f))
      .map((f) => join(root, f))
      .filter((f) => existsSync(f));
  } catch {
    console.warn(`check-migrations: cannot diff against ${baseRef}; checking every migration.`);
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(migrationsDir, entry.name, 'migration.sql'))
      .filter((f) => existsSync(f));
  }
}

function isBoilerplate(file) {
  const dir = relative(migrationsDir, file).split(sep)[0];
  return /^0001_/.test(dir) || /_init$/.test(dir);
}

const files = changedMigrationFiles();
let failed = false;
for (const file of files) {
  const findings = findViolations(readFileSync(file, 'utf8'), { boilerplate: isBoilerplate(file) });
  for (const finding of findings) {
    failed = true;
    console.error(`${relative(root, file)}: ${finding}`);
  }
}

if (failed) {
  console.error(
    '\nDestructive changes need a decision record under docs/decisions/ and a "-- decision: NNN" comment in the migration; every product migration starts with SET lock_timeout.',
  );
  process.exit(1);
}
console.log(`check-migrations: ${files.length} migration file(s) checked, no findings.`);
