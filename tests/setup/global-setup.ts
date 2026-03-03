import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Temp file used to pass env vars from globalSetup to test workers */
const ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../.test-env.json');
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password';

/**
 * Runs a WP-CLI command inside the wp-env container and returns the WP-CLI
 * output only, stripping the wp-env runner log lines (ℹ/✔ prefixed)
 */
function wpCli(command: string): string {
  const raw = execSync(`npx wp-env run cli -- wp ${command}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return stripWpEnvOutput(raw);
}

/**
 * Strips wp-env status/info lines (ℹ/✔) from command output, returning
 * only the actual command stdout
 */
function stripWpEnvOutput(raw: string): string {
  const lines = raw.split('\n').filter(
    (line) =>
      line.trim() !== '' &&
      !line.startsWith('ℹ') &&
      !line.startsWith('✔') &&
      !line.startsWith('\u2139') &&
      !line.startsWith('\u2714')
  );

  return lines.join('\n').trim();
}

/**
 * Generates an application password for the admin user
 */
function createAppPassword(): string {
  const raw = wpCli(`user application-password create ${DEFAULT_ADMIN_USERNAME} vitest --porcelain`);
  // Output format: "<password> <id>" — we need just the password (first token)
  return raw.split(/\s+/)[0];
}

/**
 * Keeps the local admin password deterministic so JWT auth setup stays stable.
 */
function resetAdminPassword(): void {
  wpCli(`user update ${DEFAULT_ADMIN_USERNAME} --user_pass=${DEFAULT_ADMIN_PASSWORD}`);
}

/**
 * Requests one JWT token from the local WordPress JWT auth endpoint.
 */
async function createJwtToken(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: DEFAULT_ADMIN_USERNAME,
      password: DEFAULT_ADMIN_PASSWORD,
    }),
  });

  const data: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    typeof data !== 'object' ||
    data === null ||
    typeof (data as { token?: unknown }).token !== 'string'
  ) {
    throw new Error('Failed to create JWT token during global setup.');
  }

  return (data as { token: string }).token;
}

/**
 * Waits for the WordPress REST API to respond before running tests
 */
async function waitForApi(baseUrl: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`WordPress API at ${baseUrl} did not become ready`);
}

/**
 * Global setup: called once before all integration tests.
 * Content seeding is handled by wp-env's afterStart lifecycle script
 * (see .wp-env.json), so this only needs to wait for the API and
 * create an application password plus JWT token for authenticated endpoint tests.
 */
export async function setup(): Promise<void> {
  const baseUrl = process.env.WP_BASE_URL || 'http://localhost:8888';

  console.log('[global-setup] Waiting for WordPress API...');
  await waitForApi(baseUrl);

  console.log('[global-setup] Resetting admin password...');
  resetAdminPassword();

  console.log('[global-setup] Creating application password...');
  const appPassword = createAppPassword();

  console.log('[global-setup] Creating JWT token...');
  const jwtToken = await createJwtToken(baseUrl);

  // Persist env vars to a file so test workers can read them (globalSetup runs
  // in a separate process — process.env changes are not inherited by workers)
  const envData = {
    WP_BASE_URL: baseUrl,
    WP_APP_PASSWORD: appPassword,
    WP_JWT_TOKEN: jwtToken,
  };
  writeFileSync(ENV_FILE, JSON.stringify(envData), 'utf-8');

  // Also set in this process for convenience
  Object.assign(process.env, envData);

  console.log('[global-setup] Done.');
}

/**
 * Global teardown: called once after all integration tests
 */
export async function teardown(): Promise<void> {
  console.log('[global-teardown] Cleaning up...');

  // Remove the app password
  try {
    wpCli(`user application-password delete ${DEFAULT_ADMIN_USERNAME} --all`);
  } catch {
    // Ignore — container may already be down
  }

  // Remove temp env file
  try {
    unlinkSync(ENV_FILE);
  } catch {
    // File may already be gone
  }

  console.log('[global-teardown] Done.');
}
