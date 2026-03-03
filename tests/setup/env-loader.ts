import { readFileSync } from 'fs';

/**
 * Loads env vars written by global-setup into each Vitest worker process.
 * globalSetup runs in a separate process, so process.env changes there
 * do not propagate to worker threads — this bridge file handles that.
 */
const envFile = new URL('../../.test-env.json', import.meta.url);

try {
  const raw = readFileSync(envFile, 'utf-8');
  const vars = JSON.parse(raw) as Record<string, string>;
  Object.assign(process.env, vars);
} catch (err) {
  // Only ignore missing file — all other errors (corrupt JSON, etc.) should surface
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw err;
  }
}
