import {
  ActionError,
  defineAction,
  type ActionAPIContext,
  type ActionClient,
} from 'astro:actions';
import type { APIContext } from 'astro';
import { z } from 'astro/zod';
import {
  WordPressClient,
  createAuthResolver,
  resolveWordPressAuth,
  createJwtAuthHeader,
  type JwtAuthTokenResponse,
  type WordPressAuthor,
  type WordPressClientConfig,
  type ResolvableWordPressAuth,
} from 'fluent-wp-client';
import {
  jwtAuthErrorResponseSchema,
  jwtAuthTokenResponseSchema,
  wordPressErrorSchema,
} from 'fluent-wp-client/zod';

const DEFAULT_COOKIE_NAME = 'wp_astro_auth';
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_COOKIE_SAME_SITE: 'lax' = 'lax';
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 12;
const loginUsernameOrEmailSchema = z.string().trim().min(1).max(320);

type JwtAuthErrorResponse = {
  code?: string;
  message: string;
  statusCode?: number;
  data?: { status?: number };
};

/**
 * Input schema for WordPress login requests handled by Astro server actions.
 */
export const wordPressLoginInputSchema = z
  .object({
    usernameOrEmail: loginUsernameOrEmailSchema,
    password: z.string().min(1).max(512),
    redirectTo: z.string().optional(),
  })
  .strict();

/**
 * Type-safe login payload inferred from the shared login schema output.
 */
export type WordPressLoginInput = z.infer<typeof wordPressLoginInputSchema>;

/**
 * Type-safe login payload expected by callers, inferred from the shared login schema input.
 */
export type WordPressLoginActionPayload = z.input<typeof wordPressLoginInputSchema>;

/**
 * Successful login payload returned by the packaged WordPress login action.
 */
export interface WordPressLoginActionResult {
  redirectTo: string;
  userId: number;
  userName: string;
}

/**
 * Strongly typed login action client using the predefined Zod payload schema.
 */
export type WordPressLoginAction = ActionClient<
  WordPressLoginActionResult,
  'form',
  typeof wordPressLoginInputSchema
>;

/**
 * Configuration options for the packaged Astro-to-WordPress authentication bridge.
 * 
 * Extends WordPressClientConfig patterns to allow unified auth configuration
 * across loaders, actions, and the auth bridge. Supports both static auth
 * and context-aware resolvers.
 */
export interface WordPressAuthBridgeConfig extends Pick<
  WordPressClientConfig,
  'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'
> {
  /** Cookie name for storing JWT session (default: 'wp_astro_auth') */
  cookieName?: string;
  /** Cookie path (default: '/') */
  cookiePath?: string;
  /** Cookie SameSite attribute (default: 'lax') */
  cookieSameSite?: 'lax' | 'strict' | 'none';
  /** Whether cookies require HTTPS (default: auto-detected from context) */
  secureCookies?: boolean;
  /** Session duration in seconds when JWT has no explicit expiry (default: 12 hours) */
  sessionDurationSeconds?: number;
  /** 
   * Context-aware auth resolver for dynamic auth extraction.
   * Allows auth to be resolved per-request from cookies, headers, etc.
   * If not provided, the bridge defaults to JWT cookie / Bearer header auth.
   * Static bridge auth is only used when client helpers opt into fallback.
   */
  authResolver?: ResolvableWordPressAuth<Pick<ActionAPIContext, 'cookies' | 'request'>>;
}

/**
 * Decoded authentication session represented by the JWT token stored in a cookie.
 */
export interface WordPressAuthSession {
  id: string;
  token: string;
  authHeader: string;
  userId: number | null;
  expiresAt: number | null;
}

/**
 * Resolved client config returned by bridge helpers for one request.
 */
export type WordPressAuthBridgeResolvedClientConfig = Pick<
  WordPressClientConfig,
  'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'
>;

/**
 * Shared request-resolution options used by bridge client helpers.
 */
export interface WordPressAuthBridgeRequestOptions {
  /** Opts into bridge-level static auth when request auth is unavailable. */
  allowStaticAuthFallback?: boolean;
}

/**
 * Client options accepted by helpers that create one request-scoped client.
 */
export interface WordPressAuthBridgeClientOptions extends Omit<
  WordPressClientConfig,
  'baseUrl' | 'auth' | 'authHeader'
>, WordPressAuthBridgeRequestOptions {}

/**
 * Return value of the packaged auth bridge factory used by Astro actions and middleware.
 */
export interface WordPressAuthBridge {
  cookieName: string;
  baseUrl: string;
  loginAction: WordPressLoginAction;
  getSession: (sessionId: string | undefined) => WordPressAuthSession | null;
  deleteSession: (sessionId: string | undefined) => void;
  clearCookie: (cookies: APIContext['cookies']) => void;
  clearAuthentication: (cookies: APIContext['cookies'], sessionId?: string | undefined) => void;
  resolveUserBySessionId: (sessionId: string | undefined) => Promise<WordPressAuthor | null>;
  /**
   * Returns a configured WordPressClient instance for one request-authenticated context.
   * This is a convenience method that creates a client from getClientConfig().
   * Note: Creates a new client instance on each call. For repeated use within a
   * single request, consider caching the client manually or using withClient().
   * Returns null if the request is not authenticated.
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   * 
   * @example
   * // In middleware - direct client usage
   * const wp = await bridge.getClient(context);
   * if (!wp) return Response.redirect('/login', 302);
   * const user = await wp.getCurrentUser();
   * 
   * @example
   * // Reuse the authenticated client in one request handler
   * const wp = await bridge.getClient(context);
   * const posts = await wp.getPosts();
   */
  getClient: (
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    options?: WordPressAuthBridgeClientOptions,
  ) => Promise<WordPressClient | null>;
  /**
   * Returns a public (unauthenticated) WordPressClient for the configured baseUrl.
   * Useful for read-only operations on public content.
   * 
   * @example
   * const wp = bridge.getPublicClient();
   * const posts = await wp.getPosts({ status: 'publish' });
   */
  getPublicClient: (
    options?: Omit<WordPressClientConfig, 'baseUrl' | 'auth' | 'authHeader'>
  ) => WordPressClient;
  /**
   * Executes a callback with one request-authenticated client, handling null cases automatically.
   * Returns the fallback value or null if the request is not authenticated.
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   * 
   * @example
   * const user = await bridge.withClient(context, async (wp) => {
   *   return await wp.getCurrentUser();
   * });
   * 
   * @example
   * const posts = await bridge.withClient(
   *   context,
   *   async (wp) => await wp.getPosts(),
   *   [] // fallback if not authenticated
   * );
   */
  withClient: <T>(
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    callback: (client: WordPressClient) => Promise<T>,
    fallback?: T,
    options?: WordPressAuthBridgeClientOptions,
  ) => Promise<T | null>;
  /**
   * Returns a complete WordPressClientConfig for one request-authenticated context.
   * This config can be used directly with new WordPressClient() or other custom wrappers.
   * Returns null if the request is not authenticated.
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   * 
   * Tries to resolve auth from the authResolver first. Static bridge auth is only
   * considered when fallback is explicitly enabled.
   * 
   * @example
   * // Use with fluent-wp-client directly
   * const config = await bridge.getClientConfig(context);
   * if (!config) return new Response('Unauthorized', { status: 401 });
   * const client = new WordPressClient(config);
   * const user = await client.getCurrentUser();
   * 
   * @example
   * // Use with actions that still need raw config
   * const config = await bridge.getClientConfig(context);
   * const client = config ? new WordPressClient(config) : null;
   */
  getClientConfig: (
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    options?: WordPressAuthBridgeRequestOptions,
  ) => Promise<WordPressAuthBridgeResolvedClientConfig | null>;
  /**
   * Resolves the current authenticated user from request-derived auth only.
   * Bridge-level static auth is intentionally ignored.
   */
  resolveUser: (context: Pick<APIContext, 'cookies' | 'request'>) => Promise<WordPressAuthor | null>;
  /**
   * Checks whether the incoming request has one authenticated user session.
   * Bridge-level static auth is intentionally ignored.
   */
  isAuthenticated: (context: Pick<APIContext, 'cookies' | 'request'>) => Promise<boolean>;
}

/**
 * Sanitizes redirects so successful authentication always returns to a local path.
 */
function sanitizeRedirectPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith('/')) {
    return '/';
  }

  if (candidate.startsWith('//')) {
    return '/';
  }

  if (candidate === '/login' || candidate.startsWith('/login?')) {
    return '/';
  }

  if (candidate === '/logout' || candidate.startsWith('/logout?')) {
    return '/';
  }

  return candidate;
}

/**
 * Converts one base64url string into padded base64 expected by web-standard decoders.
 */
function normalizeBase64UrlValue(value: string): string {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const missingPadding = normalizedValue.length % 4;

  if (missingPadding === 0) {
    return normalizedValue;
  }

  return `${normalizedValue}${'='.repeat(4 - missingPadding)}`;
}

/**
 * Decodes one base64url value to UTF-8 text with runtime-safe web APIs.
 */
function decodeBase64UrlUtf8(value: string): string {
  const normalizedValue = normalizeBase64UrlValue(value);
  const binaryValue = atob(normalizedValue);
  const bytes = Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

/**
 * Checks whether one HTTP status represents an authentication failure.
 */
function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Extracts one readable WordPress error message from a REST response payload.
 */
function getWordPressErrorMessage(data: unknown, response: Response): string {
  if (typeof data === 'object' && data !== null && typeof (data as { message?: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }

  return `WordPress API error: ${response.status} ${response.statusText}`;
}

/**
 * Validates the minimum `/users/me` response shape before exposing the user.
 */
function isWordPressAuthor(value: unknown): value is WordPressAuthor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<WordPressAuthor>;

  return typeof candidate.id === 'number'
    && typeof candidate.name === 'string'
    && typeof candidate.slug === 'string';
}

/**
 * Checks whether the JWT endpoint reported a server-side configuration error.
 */
function isJwtAuthConfigurationError(error: JwtAuthErrorResponse | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === 'jwt_auth_bad_config') {
    return true;
  }

  return /JWT is not configured properly/i.test(error.message);
}

/**
 * Decodes the JWT payload to inspect expiration and user metadata claims.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const tokenParts = token.split('.');

  if (tokenParts.length < 2) {
    return null;
  }

  try {
    const decodedPayload = decodeBase64UrlUtf8(tokenParts[1]);
    const parsedPayload: unknown = JSON.parse(decodedPayload);

    if (typeof parsedPayload !== 'object' || parsedPayload === null) {
      return null;
    }

    return parsedPayload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads the `exp` claim in seconds and converts it to a Unix timestamp in ms.
 */
function getJwtExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return null;
  }

  const expiresAtSeconds = payload.exp;

  if (typeof expiresAtSeconds !== 'number' || !Number.isFinite(expiresAtSeconds)) {
    return null;
  }

  return expiresAtSeconds * 1000;
}

/**
 * Extracts one Bearer token from an Authorization header when available.
 */
function getBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  if (!token) {
    return null;
  }

  return token;
}

/**
 * Extracts one JWT token from resolved request auth when the auth uses Bearer semantics.
 */
function getResolvedAuthToken(auth: unknown): string | null {
  if (typeof auth === 'string') {
    return getBearerToken(auth);
  }

  if (typeof auth !== 'object' || auth === null || !('token' in auth)) {
    return null;
  }

  const token = (auth as { token?: unknown }).token;

  if (typeof token !== 'string') {
    return null;
  }

  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return null;
  }

  return trimmedToken;
}

/**
 * Treats locally expired JWT request auth as unavailable so bridge fallbacks can apply.
 */
function isResolvedAuthExpired(auth: unknown): boolean {
  const token = getResolvedAuthToken(auth);

  if (!token) {
    return false;
  }

  const expiresAt = getJwtExpiry(token);

  if (expiresAt === null) {
    return false;
  }

  return expiresAt <= Date.now();
}

/**
 * Reads the WordPress user ID claim from JWT payload metadata when available.
 */
function getJwtUserId(token: string): number | null {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.data !== 'object' || payload.data === null) {
    return null;
  }

  const userValue = (payload.data as { user?: { id?: unknown } }).user?.id;

  if (typeof userValue === 'number' && Number.isFinite(userValue)) {
    return userValue;
  }

  if (typeof userValue !== 'string') {
    return null;
  }

  const parsedUserId = Number.parseInt(userValue, 10);

  if (!Number.isFinite(parsedUserId)) {
    return null;
  }

  return parsedUserId;
}

/**
 * Builds a normalized auth session object from one JWT token string.
 */
function createSessionFromToken(token: string): WordPressAuthSession {
  const trimmedToken = token.trim();

  return {
    id: trimmedToken,
    token: trimmedToken,
    authHeader: createJwtAuthHeader(trimmedToken),
    userId: getJwtUserId(trimmedToken),
    expiresAt: getJwtExpiry(trimmedToken),
  };
}

/**
 * Checks whether a decoded JWT session is already expired.
 */
function isSessionExpired(session: WordPressAuthSession): boolean {
  if (!session.expiresAt) {
    return false;
  }

  return session.expiresAt <= Date.now();
}

/**
 * Calculates the cookie lifetime while respecting both local config and JWT expiry.
 */
function getCookieMaxAge(defaultSeconds: number, expiresAt: number | null): number {
  if (!expiresAt) {
    return defaultSeconds;
  }

  const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);

  if (remainingSeconds <= 0) {
    return 0;
  }

  return Math.min(defaultSeconds, remainingSeconds);
}

/**
 * Creates a WordPress client with the bridge's base configuration.
 * Handles both object-based auth configs and string-based auth headers.
 */
function createBridgeClient(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'>
): WordPressClient {
  const clientConfig = getStaticClientConfig(config);

  if (!clientConfig) {
    return new WordPressClient({
      baseUrl: config.baseUrl,
    });
  }

  return new WordPressClient(clientConfig);
}

/**
 * Builds one request-scoped client config from resolved request auth.
 */
function createRequestClientConfig(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'authHeaders'>,
  resolvedAuth: unknown,
): WordPressAuthBridgeResolvedClientConfig {
  if (typeof resolvedAuth === 'string') {
    return {
      baseUrl: config.baseUrl,
      authHeader: resolvedAuth,
      authHeaders: config.authHeaders,
    };
  }

  return {
    baseUrl: config.baseUrl,
    auth: resolvedAuth as WordPressAuthBridgeResolvedClientConfig['auth'],
    authHeaders: config.authHeaders,
  };
}

/**
 * Builds one client config from the bridge's static auth settings.
 */
function getStaticClientConfig(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'>,
): WordPressAuthBridgeResolvedClientConfig | null {
  const authHeader = config.authHeader ?? (typeof config.auth === 'string' ? config.auth : undefined);

  if (authHeader) {
    return {
      baseUrl: config.baseUrl,
      authHeader,
      authHeaders: config.authHeaders,
    };
  }

  if (typeof config.auth === 'object' && config.auth !== null) {
    return {
      baseUrl: config.baseUrl,
      auth: config.auth,
      authHeaders: config.authHeaders,
    };
  }

  if (config.authHeaders) {
    return {
      baseUrl: config.baseUrl,
      authHeaders: config.authHeaders,
    };
  }

  return null;
}

/**
 * Authenticates with the JWT plugin endpoint and returns one signed token.
 */
async function loginWithWordPressJwt(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'>,
  usernameOrEmail: string,
  password: string,
): Promise<string> {
  const client = createBridgeClient(config);

  let tokenResponseData: JwtAuthTokenResponse;

  try {
    tokenResponseData = await client.loginWithJwt({
      username: usernameOrEmail,
      password,
    });
  } catch (error) {
    if (!(error instanceof Error) || !("status" in error)) {
      throw error;
    }

    const responseStatus = typeof error.status === 'number' ? error.status : 500;
    const responseBody = 'responseBody' in error ? error.responseBody : null;

    if (responseStatus === 404) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'WordPress JWT endpoint is missing. Activate the jwt-authentication-for-wp-rest-api plugin.',
      });
    }

    const parsedJwtError = jwtAuthErrorResponseSchema.safeParse(responseBody);
    const jwtError = parsedJwtError.success ? parsedJwtError.data : null;
    const jwtErrorStatus = jwtError?.data?.status ?? jwtError?.statusCode ?? responseStatus;

    if (isJwtAuthConfigurationError(jwtError) || jwtErrorStatus >= 500) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: jwtError?.message ?? 'WordPress JWT authentication is not configured correctly.',
      });
    }

    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: jwtError?.message ?? 'WordPress rejected these credentials.',
    });
  }

  const tokenResponse = jwtAuthTokenResponseSchema.safeParse(tokenResponseData);

  if (!tokenResponse.success) {
    throw new ActionError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'WordPress JWT endpoint returned an invalid token payload.',
    });
  }

  return tokenResponse.data.token;
}

/**
 * Resolves the authenticated WordPress user associated with one JWT token.
 */
async function resolveUserByToken(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'>,
  token: string
): Promise<WordPressAuthor | null> {
  const client = new WordPressClient({
    baseUrl: config.baseUrl,
    auth: { token },
  });

  let user: unknown;

  try {
    user = await client.getCurrentUser();
  } catch (error) {
    if (!(error instanceof Error) || !("status" in error)) {
      throw error;
    }

    const responseStatus = typeof error.status === 'number' ? error.status : 500;
    const responseBody = 'responseBody' in error ? error.responseBody : null;
    const wpError = wordPressErrorSchema.safeParse(responseBody);

    if (wpError.success && wpError.data.code === 'jwt_auth_bad_config') {
      throw new Error(wpError.data.message);
    }

    if (isAuthFailureStatus(responseStatus)) {
      return null;
    }

    throw new Error(
      wpError.success
        ? wpError.data.message
        : error.message,
    );
  }

  if (!isWordPressAuthor(user)) {
    throw new Error('WordPress /users/me returned an invalid user payload.');
  }

  return user;
}

/**
 * Creates one normalized session error for invalid or unusable JWT login results.
 */
function createInvalidSessionError(): ActionError {
  return new ActionError({
    code: 'UNAUTHORIZED',
    message: 'WordPress returned an expired or invalid JWT session.',
  });
}

/**
 * Resolves one authenticated WordPress user after a successful JWT login.
 */
async function resolveLoggedInUser(
  config: Pick<WordPressAuthBridgeConfig, 'baseUrl' | 'auth' | 'authHeader' | 'authHeaders'>,
  token: string
): Promise<WordPressAuthor> {
  const user = await resolveUserByToken(config, token);

  if (!user) {
    throw createInvalidSessionError();
  }

  return user;
}

/**
 * Default auth resolver that extracts JWT from the configured cookie.
 */
function createDefaultCookieAuthResolver(
  cookieName: string
) {
  return createAuthResolver((context: Pick<ActionAPIContext, 'cookies' | 'request'>) => {
    const jwt = context.cookies.get(cookieName)?.value;
    
    if (jwt) {
      return { token: jwt };
    }

    // Also check for Authorization header as fallback
    const authHeader = context.request.headers.get('authorization');

    if (authHeader && getBearerToken(authHeader)) {
      return authHeader;
    }

    return null;
  });
}

/**
 * Creates a ready-to-use WordPress authentication bridge with a predefined login server action.
 * 
 * Supports unified auth configuration via `auth`, `authHeaders`, or `authResolver` options,
 * aligning with WordPressClientConfig patterns used by loaders and actions.
 */
export function createWordPressAuthBridge(config: WordPressAuthBridgeConfig): WordPressAuthBridge {
  const normalizedConfig = {
    baseUrl: config.baseUrl,
    auth: config.auth,
    authHeader: config.authHeader,
    authHeaders: config.authHeaders,
    secureCookies: config.secureCookies,
    cookieName: config.cookieName || DEFAULT_COOKIE_NAME,
    cookiePath: config.cookiePath || DEFAULT_COOKIE_PATH,
    cookieSameSite: config.cookieSameSite || DEFAULT_COOKIE_SAME_SITE,
    sessionDurationSeconds: config.sessionDurationSeconds || DEFAULT_SESSION_DURATION_SECONDS,
  };

  // Create auth resolver: use provided resolver or default cookie-based resolver
  const authResolver = config.authResolver ?? createDefaultCookieAuthResolver(normalizedConfig.cookieName);

  /**
   * Reads one JWT session from cookie value and returns null when missing/invalid.
   */
  function getSession(sessionId: string | undefined): WordPressAuthSession | null {
    if (!sessionId) {
      return null;
    }

    const token = sessionId.trim();

    if (!token) {
      return null;
    }

    const session = createSessionFromToken(token);

    if (!isSessionExpired(session)) {
      return session;
    }

    return null;
  }

  /**
   * JWT sessions are stateless, so explicit server-side deletion is a no-op.
   */
  function deleteSession(_sessionId: string | undefined): void {
    return;
  }

  /**
   * Deletes the configured authentication cookie from the current Astro response.
   */
  function clearCookie(cookies: APIContext['cookies']): void {
    cookies.delete(normalizedConfig.cookieName, {
      path: normalizedConfig.cookiePath,
    });
  }

  /**
   * Clears browser cookie state for one authentication context.
   */
  function clearAuthentication(cookies: APIContext['cookies'], _sessionId?: string | undefined): void {
    clearCookie(cookies);
  }

  /**
   * Resolves one WordPress user from a cookie-provided JWT token.
   */
  async function resolveUserBySessionId(sessionId: string | undefined): Promise<WordPressAuthor | null> {
    const session = getSession(sessionId);

    if (!session) {
      return null;
    }

    return resolveUserByToken(normalizedConfig, session.token);
  }

  /**
   * Returns a complete WordPressClientConfig for one request-authenticated context.
   * This config can be used directly with new WordPressClient() or spread into action factories.
   * Returns null if the request is not authenticated.
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   * 
   * Tries to resolve auth from the authResolver first. Static bridge auth is only
   * considered when fallback is explicitly enabled.
   */
  async function getClientConfig(
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    options?: WordPressAuthBridgeRequestOptions,
  ): Promise<WordPressAuthBridgeResolvedClientConfig | null> {
    const resolvedAuth = await resolveWordPressAuth(authResolver, context);

    if (resolvedAuth && !isResolvedAuthExpired(resolvedAuth)) {
      return createRequestClientConfig(normalizedConfig, resolvedAuth);
    }

    if (!options?.allowStaticAuthFallback) {
      return null;
    }

    return getStaticClientConfig(normalizedConfig);
  }

  /**
   * Returns a configured WordPressClient instance for one request-authenticated context.
   * Convenience wrapper around getClientConfig() that creates the client for you.
   * Note: Creates a new client instance on each call. For repeated use within a
   * single request, consider caching the client manually or using withClient().
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   */
  async function getClient(
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    options?: WordPressAuthBridgeClientOptions,
  ): Promise<WordPressClient | null> {
    const {
      allowStaticAuthFallback,
      ...clientOptions
    } = options ?? {};
    const clientConfig = await getClientConfig(context, { allowStaticAuthFallback });
    
    if (!clientConfig) {
      return null;
    }

    return new WordPressClient({
      ...clientOptions,
      ...clientConfig,
    });
  }

  /**
   * Returns a public (unauthenticated) WordPressClient for the configured baseUrl.
   * Useful for read-only operations on public content.
   */
  function getPublicClient(
    options?: Omit<WordPressClientConfig, 'baseUrl' | 'auth' | 'authHeader'>
  ): WordPressClient {
    return new WordPressClient({
      ...options,
      baseUrl: normalizedConfig.baseUrl,
    });
  }

  /**
   * Executes a callback with one request-authenticated client, handling null cases automatically.
   * If the request is not authenticated, returns the provided fallback value or null.
   * Pass `allowStaticAuthFallback: true` to opt into bridge-level static auth.
   * 
   * @example
   * // Get user with the client
   * const user = await bridge.withClient(context, async (wp) => {
   *   return await wp.getCurrentUser();
   * });
   * 
   * @example
   * // Get posts with fallback
   * const posts = await bridge.withClient(
   *   context,
   *   async (wp) => await wp.getPosts(),
   *   [] // fallback if not authenticated
   * );
   */
  async function withClient<T>(
    context: Pick<ActionAPIContext, 'cookies' | 'request'>,
    callback: (client: WordPressClient) => Promise<T>,
    fallback?: T,
    options?: WordPressAuthBridgeClientOptions,
  ): Promise<T | null> {
    const client = await getClient(context, options);
    
    if (!client) {
      return fallback ?? null;
    }

    try {
      return await callback(client);
    } finally {
      // Client cleanup if needed in future
    }
  }

  /**
   * Resolves the authenticated user directly from middleware context.
   * Ignores bridge-level static auth so the result always reflects request user state.
   */
  async function resolveUser(context: Pick<APIContext, 'cookies' | 'request'>): Promise<WordPressAuthor | null> {
    return withClient(context, async (client) => {
      const user = await client.getCurrentUser();
      return isWordPressAuthor(user) ? user : null;
    }, null);
  }

  /**
   * Checks whether the incoming request has one valid, usable user session.
   * Ignores bridge-level static auth so the result always reflects request user state.
   */
  async function isAuthenticated(context: Pick<APIContext, 'cookies' | 'request'>): Promise<boolean> {
    const user = await resolveUser(context);
    return user !== null;
  }

  const loginAction: WordPressLoginAction = defineAction({
    accept: 'form',
    input: wordPressLoginInputSchema,
    handler: async (
      input: WordPressLoginInput,
      context: ActionAPIContext,
    ): Promise<WordPressLoginActionResult> => {
      const token = await loginWithWordPressJwt(
        normalizedConfig,
        input.usernameOrEmail,
        input.password,
      );

      const session = getSession(token);

      if (!session) {
        throw createInvalidSessionError();
      }

      const user = await resolveLoggedInUser(normalizedConfig, session.token);

      context.cookies.set(normalizedConfig.cookieName, session.token, {
        path: normalizedConfig.cookiePath,
        httpOnly: true,
        sameSite: normalizedConfig.cookieSameSite,
        secure: normalizedConfig.secureCookies ?? context.url.protocol === 'https:',
        maxAge: getCookieMaxAge(normalizedConfig.sessionDurationSeconds, session.expiresAt),
      });

      return {
        redirectTo: sanitizeRedirectPath(input.redirectTo),
        userId: user.id,
        userName: user.name,
      };
    },
  });

  return {
    cookieName: normalizedConfig.cookieName,
    baseUrl: normalizedConfig.baseUrl,
    loginAction,
    getSession,
    deleteSession,
    clearCookie,
    clearAuthentication,
    resolveUserBySessionId,
    getClientConfig,
    getClient,
    getPublicClient,
    withClient,
    resolveUser,
    isAuthenticated,
  };
}
