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
 * Extracts one `name=value` pair from a raw Set-Cookie header value.
 */
function getCookiePair(setCookieValue: string): string {
  return setCookieValue.split(';')[0].trim();
}

/**
 * Reads all Set-Cookie headers from one fetch response.
 */
function getSetCookieHeaders(response: Response): string[] {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    return headersWithSetCookie.getSetCookie();
  }

  const fallback = response.headers.get('set-cookie');

  if (!fallback) {
    return [];
  }

  return [fallback];
}

/**
 * Creates one logged-in cookie + REST nonce pair through a real wp-admin login flow.
 */
async function createCookieAuthSession(baseUrl: string): Promise<{ cookieHeader: string; restNonce: string }> {
  const preflightResponse = await fetch(`${baseUrl}/wp-login.php`, {
    redirect: 'manual',
  });
  const preflightCookies = getSetCookieHeaders(preflightResponse)
    .map(getCookiePair)
    .filter((pair) => pair.length > 0)
    .join('; ');

  const loginForm = new URLSearchParams({
    log: DEFAULT_ADMIN_USERNAME,
    pwd: DEFAULT_ADMIN_PASSWORD,
    'wp-submit': 'Log In',
    redirect_to: `${baseUrl}/wp-admin/`,
    testcookie: '1',
  });

  const loginResponse = await fetch(`${baseUrl}/wp-login.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(preflightCookies ? { Cookie: preflightCookies } : {}),
    },
    body: loginForm.toString(),
    redirect: 'manual',
  });

  const setCookies = [
    ...getSetCookieHeaders(loginResponse),
    ...getSetCookieHeaders(preflightResponse),
  ];

  if (setCookies.length === 0) {
    throw new Error('Failed to create cookie auth session during global setup (missing Set-Cookie headers).');
  }

  const cookieHeader = setCookies
    .map(getCookiePair)
    .filter((pair) => pair.length > 0)
    .join('; ');

  if (!cookieHeader) {
    throw new Error('Failed to create cookie auth session during global setup (empty cookie header).');
  }

  const adminResponse = await fetch(`${baseUrl}/wp-admin/`, {
    headers: {
      Cookie: cookieHeader,
    },
  });

  const adminHtml = await adminResponse.text();
  const nonceMatch = adminHtml.match(/"nonce":"([^"]+)"/);
  const restNonce = nonceMatch?.[1];

  if (!restNonce) {
    throw new Error('Failed to extract wpApiSettings nonce during global setup.');
  }

  return {
    cookieHeader,
    restNonce,
  };
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
 * create app-password, JWT, and cookie+nonce auth credentials for integration tests.
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

  console.log('[global-setup] Creating cookie auth session...');
  const cookieAuthSession = await createCookieAuthSession(baseUrl);

  // Persist env vars to a file so test workers can read them (globalSetup runs
  // in a separate process — process.env changes are not inherited by workers)
  const envData = {
    WP_BASE_URL: baseUrl,
    WP_APP_PASSWORD: appPassword,
    WP_JWT_TOKEN: jwtToken,
    WP_COOKIE_AUTH_HEADER: cookieAuthSession.cookieHeader,
    WP_REST_NONCE: cookieAuthSession.restNonce,
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
