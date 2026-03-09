import { WordPressClient } from 'fluent-wp-client';

/**
 * Resolves the WP base URL from the environment (set by global setup)
 */
export function getBaseUrl(): string {
  return process.env.WP_BASE_URL || 'http://localhost:8888';
}

/**
 * Creates an unauthenticated client for public endpoint tests
 */
export function createPublicClient(): WordPressClient {
  return new WordPressClient({ baseUrl: getBaseUrl() });
}

/**
 * Creates an authenticated client with the app password generated during global setup
 */
export function createAuthClient(): WordPressClient {
  const password = process.env.WP_APP_PASSWORD;
  if (!password) {
    throw new Error('WP_APP_PASSWORD not set — did global-setup run?');
  }

  return new WordPressClient({
    baseUrl: getBaseUrl(),
    auth: { username: 'admin', password },
  });
}

/**
 * Creates an authenticated client using the JWT generated during global setup.
 */
export function createJwtAuthClient(): WordPressClient {
  const token = process.env.WP_JWT_TOKEN;

  if (!token) {
    throw new Error('WP_JWT_TOKEN not set — did global-setup run?');
  }

  return new WordPressClient({
    baseUrl: getBaseUrl(),
    auth: { token },
  });
}

/**
 * Creates a cookie-authenticated client using a seeded nonce + auth cookie pair.
 */
export function createCookieAuthClient(): WordPressClient {
  const nonce = process.env.WP_REST_NONCE;
  const cookieHeader = process.env.WP_COOKIE_AUTH_HEADER;

  if (!nonce) {
    throw new Error('WP_REST_NONCE not set — did global-setup run?');
  }

  if (!cookieHeader) {
    throw new Error('WP_COOKIE_AUTH_HEADER not set — did global-setup run?');
  }

  return new WordPressClient({
    baseUrl: getBaseUrl(),
    auth: { nonce, credentials: 'include' },
    credentials: 'include',
    cookies: cookieHeader,
  });
}

/**
 * Creates the shared execute-action config used by Astro action integration tests.
 */
export function createActionBaseConfig(): { baseUrl: string } {
  return {
    baseUrl: getBaseUrl(),
  };
}
