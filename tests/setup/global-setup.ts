import { execSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveWpBaseUrl } from '../helpers/wp-env';

/** DevServer type imported at runtime to avoid TS resolution issues in globalSetup context. */
interface AstroDevServer {
  address: { port: number };
  stop(): Promise<void>;
}

/** Temp file used to pass env vars from globalSetup to test workers */
const ENV_FILE = resolve(import.meta.dirname, '../../.test-env.json');

/** Astro fixture project root for action integration tests */
const ASTRO_FIXTURE_ROOT = resolve(
  import.meta.dirname,
  '../fixtures/astro-site'
);

/** Port hint for the Astro dev server. `0` asks the OS for one free port. */
const ASTRO_DEV_PORT = 0;

/** Handle to the running Astro dev server so teardown can stop it */
let astroDevServer: AstroDevServer | null = null;
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password';

/**
 * Runs a WP-CLI command inside the wp-env container and returns the WP-CLI
 * output only, stripping the wp-env runner log lines (ℹ/✔ prefixed)
 */
function wpCli(command: string): string {
  const raw = execSync(`pnpm exec wp-env run cli -- wp ${command}`, {
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
  const lines = raw
    .split('\n')
    .filter(
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
  const raw = wpCli(
    `user application-password create ${DEFAULT_ADMIN_USERNAME} vitest --porcelain`
  );

  // Output format: "<password> <id>" — we need just the password (first token)
  return raw.split(/\s+/)[0];
}

/**
 * Keeps the local admin password deterministic so JWT auth setup stays stable.
 */
function resetAdminPassword(): void {
  wpCli(
    `user update ${DEFAULT_ADMIN_USERNAME} --user_pass=${DEFAULT_ADMIN_PASSWORD}`
  );
}

/**
 * Requests one JWT token from the local WordPress JWT auth endpoint.
 */
async function createJwtToken(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    body: JSON.stringify({
      password,
      username,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const data: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- JWT login can return an error payload; setup requires a string token.
    typeof data !== 'object' ||
    data === null ||
    !('token' in data) ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Setup needs a token string before it can authenticate fixture requests.
    typeof data.token !== 'string'
  ) {
    throw new Error(
      `Failed to create JWT token for ${username} during global setup.`
    );
  }

  return data.token;
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
  return response.headers.getSetCookie();
}

/**
 * Creates one logged-in cookie + REST nonce pair through a real wp-admin login flow.
 */
async function createCookieAuthSession(
  baseUrl: string
): Promise<{ cookieHeader: string; restNonce: string }> {
  const preflightResponse = await fetch(`${baseUrl}/wp-login.php`, {
    redirect: 'manual',
  });

  const preflightCookies = getSetCookieHeaders(preflightResponse)
    .flatMap((cookie) => {
      const pair = getCookiePair(cookie);

      return pair.length > 0 ? [pair] : [];
    })
    .join('; ');

  const loginForm = new URLSearchParams({
    log: DEFAULT_ADMIN_USERNAME,
    pwd: DEFAULT_ADMIN_PASSWORD,
    redirect_to: `${baseUrl}/wp-admin/`,
    testcookie: '1',
    'wp-submit': 'Log In',
  });

  const loginResponse = await fetch(`${baseUrl}/wp-login.php`, {
    body: loginForm.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(preflightCookies ? { Cookie: preflightCookies } : undefined),
    },
    method: 'POST',
    redirect: 'manual',
  });

  const setCookies = [
    ...getSetCookieHeaders(loginResponse),
    ...getSetCookieHeaders(preflightResponse),
  ];

  if (setCookies.length === 0) {
    throw new Error(
      'Failed to create cookie auth session during global setup (missing Set-Cookie headers).'
    );
  }

  const cookieHeader = setCookies
    .flatMap((cookie) => {
      const pair = getCookiePair(cookie);

      return pair.length > 0 ? [pair] : [];
    })
    .join('; ');

  if (!cookieHeader) {
    throw new Error(
      'Failed to create cookie auth session during global setup (empty cookie header).'
    );
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
    throw new Error(
      'Failed to extract wpApiSettings nonce during global setup.'
    );
  }

  return {
    cookieHeader,
    restNonce,
  };
}

/**
 * Global setup: called once before all integration tests.
 * Content seeding is handled by wp-env's afterStart lifecycle script
 * (see .wp-env.json), so this only creates app-password, JWT,
 * and cookie+nonce auth credentials for integration tests.
 */
export async function setup(): Promise<void> {
  const baseUrl = resolveWpBaseUrl();

  console.log('[global-setup] Resetting admin password...');
  resetAdminPassword();

  console.log('[global-setup] Creating application password...');
  const appPassword = createAppPassword();

  console.log('[global-setup] Creating admin JWT token...');

  const jwtToken = await createJwtToken(
    baseUrl,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD
  );

  console.log('[global-setup] Creating alice JWT token...');

  const aliceJwtToken = await createJwtToken(
    baseUrl,
    'alice',
    'alice-test-password'
  );

  console.log('[global-setup] Creating bob JWT token...');
  const bobJwtToken = await createJwtToken(baseUrl, 'bob', 'bob-test-password');

  console.log('[global-setup] Creating cookie auth session...');
  const cookieAuthSession = await createCookieAuthSession(baseUrl);

  // Persist env vars to a file so test workers can read them (globalSetup runs
  // in a separate process — process.env changes are not inherited by workers)
  const envData = {
    ASTRO_DEV_URL: '',
    WP_ALICE_JWT_TOKEN: aliceJwtToken,
    WP_APP_PASSWORD: appPassword,
    WP_BASE_URL: baseUrl,
    WP_BOB_JWT_TOKEN: bobJwtToken,
    WP_CATALOG_URL: baseUrl,
    WP_COOKIE_AUTH_HEADER: cookieAuthSession.cookieHeader,
    WP_JWT_TOKEN: jwtToken,
    WP_REST_NONCE: cookieAuthSession.restNonce,
  };

  // Also set in this process so the Astro dev server picks them up via Vite
  Object.assign(process.env, envData);

  console.log('[global-setup] Starting Astro dev server...');
  const { dev } = await import('astro');
  // Astro disables its HTTP middleware inside Vitest; this is a real HTTP fixture server.
  const vitestEnvironment = process.env.VITEST;
  delete process.env.VITEST;

  try {
    astroDevServer = await dev({
      logLevel: 'silent',
      root: ASTRO_FIXTURE_ROOT,
      server: { port: ASTRO_DEV_PORT },
    });
  } finally {
    if (vitestEnvironment !== undefined) {
      process.env.VITEST = vitestEnvironment;
    }
  }

  const astroDevUrl = `http://localhost:${astroDevServer.address.port}`;
  envData.ASTRO_DEV_URL = astroDevUrl;

  writeFileSync(ENV_FILE, JSON.stringify(envData), 'utf-8');
  process.env.ASTRO_DEV_URL = astroDevUrl;

  console.log(`[global-setup] Astro dev server listening on ${astroDevUrl}`);
  console.log('[global-setup] Done.');
}

/**
 * Global teardown: called once after all integration tests
 */
export async function teardown(): Promise<void> {
  console.log('[global-teardown] Cleaning up...');

  // Stop the Astro dev server
  if (astroDevServer) {
    try {
      await astroDevServer.stop();
    } catch {
      // Ignore — server may already be stopped
    }

    astroDevServer = null;
  }

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
