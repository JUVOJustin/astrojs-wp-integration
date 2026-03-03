/**
 * Basic authentication credentials for WordPress API
 */
export interface BasicAuthCredentials {
  username: string;
  password: string;
}

/**
 * JWT authentication token for WordPress API calls.
 */
export interface JwtAuthCredentials {
  token: string;
}

/**
 * Prebuilt Authorization header value for advanced authentication flows.
 */
export interface HeaderAuthCredentials {
  authorization: string;
}

/**
 * Supported authentication config shapes accepted by client and action helpers.
 */
export type WordPressAuthConfig =
  | BasicAuthCredentials
  | JwtAuthCredentials
  | HeaderAuthCredentials;

/**
 * Auth input that can be resolved into a final Authorization header.
 */
export type WordPressAuthInput = WordPressAuthConfig | string;

/**
 * Context-aware auth resolver for SSR and user-scoped request handling.
 */
export type WordPressAuthResolver<TContext = void> = (
  context: TContext
) => WordPressAuthInput | null | undefined | Promise<WordPressAuthInput | null | undefined>;

/**
 * Auth value that can be static or resolved per request from context.
 */
export type ResolvableWordPressAuth<TContext = void> =
  | WordPressAuthInput
  | WordPressAuthResolver<TContext>;

/**
 * Normalized request details passed to advanced auth header providers.
 */
export interface WordPressAuthRequest {
  method: string;
  url: URL;
  body?: string;
}

/**
 * Generic HTTP headers map used by advanced authentication flows.
 */
export type WordPressAuthHeaders = Record<string, string>;

/**
 * Request-aware auth header provider for signature-based auth methods.
 */
export type WordPressAuthHeadersProvider = (
  request: WordPressAuthRequest
) => WordPressAuthHeaders | Promise<WordPressAuthHeaders>;

/**
 * Checks whether the given auth config uses basic credentials.
 */
function isBasicAuthCredentials(auth: WordPressAuthConfig): auth is BasicAuthCredentials {
  return 'username' in auth && 'password' in auth;
}

/**
 * Checks whether the given auth config uses a raw JWT token.
 */
function isJwtAuthCredentials(auth: WordPressAuthConfig): auth is JwtAuthCredentials {
  return 'token' in auth;
}

/**
 * Removes any existing bearer prefix from a JWT token value.
 */
function normalizeJwtToken(token: string): string {
  return token.trim().replace(/^Bearer\s+/i, '');
}

/**
 * Validates and normalizes custom headers returned by auth providers.
 */
function normalizeAuthHeaders(headers: WordPressAuthHeaders): WordPressAuthHeaders {
  const normalizedHeaders: WordPressAuthHeaders = {};

  for (const [rawHeaderName, rawHeaderValue] of Object.entries(headers)) {
    const headerName = rawHeaderName.trim();

    if (!headerName) {
      throw new Error('Auth header name must not be empty.');
    }

    if (typeof rawHeaderValue !== 'string') {
      throw new Error(`Auth header '${headerName}' must be a string.`);
    }

    const headerValue = rawHeaderValue.trim();

    if (!headerValue) {
      continue;
    }

    normalizedHeaders[headerName] = headerValue;
  }

  return normalizedHeaders;
}

/**
 * Creates Basic Auth header from credentials
 */
export function createBasicAuthHeader(credentials: BasicAuthCredentials): string {
  const encoded = btoa(`${credentials.username}:${credentials.password}`);
  return `Basic ${encoded}`;
}

/**
 * Creates Bearer Auth header from a WordPress JWT token.
 */
export function createJwtAuthHeader(credentials: JwtAuthCredentials | string): string {
  const token = typeof credentials === 'string'
    ? normalizeJwtToken(credentials)
    : normalizeJwtToken(credentials.token);

  if (!token) {
    throw new Error('JWT token is required to build Authorization header.');
  }

  return `Bearer ${token}`;
}

/**
 * Creates an Authorization header from any supported auth config shape.
 */
export function createWordPressAuthHeader(auth: WordPressAuthInput): string {
  if (typeof auth === 'string') {
    const header = auth.trim();

    if (!header) {
      throw new Error('Authorization header must not be empty.');
    }

    return header;
  }

  if (isBasicAuthCredentials(auth)) {
    return createBasicAuthHeader(auth);
  }

  if (isJwtAuthCredentials(auth)) {
    return createJwtAuthHeader(auth);
  }

  const authorizationHeader = auth.authorization.trim();

  if (!authorizationHeader) {
    throw new Error('Authorization header must not be empty.');
  }

  return authorizationHeader;
}

/**
 * Resolves static or context-aware auth config to one concrete auth input.
 */
export async function resolveWordPressAuth<TContext>(
  auth: ResolvableWordPressAuth<TContext> | undefined,
  context: TContext,
): Promise<WordPressAuthInput | null> {
  if (!auth) {
    return null;
  }

  if (typeof auth !== 'function') {
    return auth;
  }

  const resolvedAuth = await auth(context);

  if (!resolvedAuth) {
    return null;
  }

  return resolvedAuth;
}

/**
 * Resolves final request headers from static auth and request-aware auth providers.
 */
export async function resolveWordPressRequestHeaders(config: {
  auth?: WordPressAuthInput | null;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider | null;
  request: WordPressAuthRequest;
}): Promise<WordPressAuthHeaders> {
  const resolvedHeaders: WordPressAuthHeaders = {};

  if (config.auth) {
    resolvedHeaders.Authorization = createWordPressAuthHeader(config.auth);
  }

  if (!config.authHeaders) {
    return resolvedHeaders;
  }

  const providedHeaders = typeof config.authHeaders === 'function'
    ? await config.authHeaders(config.request)
    : config.authHeaders;

  return {
    ...resolvedHeaders,
    ...normalizeAuthHeaders(providedHeaders),
  };
}
