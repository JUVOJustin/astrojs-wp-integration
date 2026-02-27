import { WordPressClient } from '../../src/client';

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
