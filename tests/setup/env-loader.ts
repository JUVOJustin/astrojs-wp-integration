import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Loads env vars written by global-setup into each Vitest worker process.
 * globalSetup runs in a separate process, so process.env changes there
 * do not propagate to worker threads — this bridge file handles that.
 */
const envFile = resolve(__dirname, '../../.test-env.json');

try {
  const raw = readFileSync(envFile, 'utf-8');
  const vars = JSON.parse(raw) as Record<string, string>;
  Object.assign(process.env, vars);
} catch {
  // File may not exist if globalSetup hasn't run yet (e.g. IDE type-check)
}
