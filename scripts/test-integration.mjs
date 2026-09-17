#!/usr/bin/env node
/**
 * Runs the Vitest integration project against a real Postgres:
 * migrates TEST_DATABASE_URL (default: the docker-compose server, database
 * `app_test`, created on demand) and then runs `vitest --project integration`.
 */
import { execSync, spawnSync } from 'node:child_process';
import 'dotenv/config';

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/app_test?schema=public';

const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url, NODE_ENV: 'test' };

// Create the database when it does not exist yet (local docker-compose only).
if (!process.env.TEST_DATABASE_URL && !process.env.CI) {
  try {
    execSync(
      `docker exec dietyaar-db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='app_test'" | grep -q 1 || docker exec dietyaar-db psql -U postgres -c "CREATE DATABASE app_test"`,
      { stdio: 'ignore', shell: '/bin/sh' },
    );
  } catch {
    // Not running through docker-compose; assume the database exists.
  }
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const args = process.argv.slice(2);
const run = spawnSync('npx', ['vitest', 'run', '--project', 'integration', ...args], {
  env,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
