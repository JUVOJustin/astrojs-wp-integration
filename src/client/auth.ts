/**
 * Basic authentication credentials for WordPress API
 */
export interface BasicAuthCredentials {
  username: string;
  password: string;
}

/**
 * Creates Basic Auth header from credentials
 */
export function createBasicAuthHeader(credentials: BasicAuthCredentials): string {
  const encoded = btoa(`${credentials.username}:${credentials.password}`);
  return `Basic ${encoded}`;
}
