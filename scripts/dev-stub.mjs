#!/usr/bin/env node
/**
 * Offline development: starts the e2e AI stub (e2e/stub-ai/server.mjs) and
 * `next dev` pointed at it, so meals and plans parse without a DeepSeek key.
 * The default `npm run dev` talks to the real API (improvement plan A1).
 *
 *   npm run dev:stub              (stub on 3999, app on 3000)
 *   AI_STUB_PORT=3998 PORT=3001 npm run dev:stub
 *
 * Both children share this process's stdio; SIGINT / SIGTERM stop them
 * together, and either one exiting stops the other.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stubPort = process.env.AI_STUB_PORT ?? '3999';
const extraArgs = process.argv.slice(2);

const stub = spawn(process.execPath, [join(root, 'e2e/stub-ai/server.mjs'), '--port', stubPort], {
  cwd: root,
  stdio: 'inherit',
});

const app = spawn('npx', ['next', 'dev', ...extraArgs], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    DEEPSEEK_API_BASE_URL: `http://localhost:${stubPort}`,
    DEEPSEEK_API_KEY: 'stub-key',
  },
});

let stopping = false;
function stop(signal, code) {
  if (stopping) return;
  stopping = true;
  for (const child of [stub, app]) if (child.exitCode === null) child.kill(signal);
  // Give the children a moment to exit before this process does.
  setTimeout(() => process.exit(code), 200).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal, 0));
stub.on('exit', (code) => stop('SIGTERM', code ?? 0));
app.on('exit', (code) => stop('SIGTERM', code ?? 0));
