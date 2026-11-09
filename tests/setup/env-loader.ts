import { readFileSync } from 'node:fs';

/**
 * Loads env vars written by global-setup into each Vitest worker process.
 * globalSetup runs in a separate process, so process.env changes there
 * do not propagate to worker threads — this bridge file handles that.
 */
const envFile = new URL('../../.test-env.json', import.meta.url);

try {
  const raw = readFileSync(envFile, 'utf-8');
  // SAFETY: global-setup writes only string environment values to this private fixture file.
  const vars = JSON.parse(raw) as Record<string, string>;
  Object.assign(process.env, vars);
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}
