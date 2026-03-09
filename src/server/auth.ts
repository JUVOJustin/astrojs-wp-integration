import {
  ActionError,
  defineAction,
  type ActionAPIContext,
  type ActionClient,
} from 'astro/actions/runtime/server.js';
import type { APIContext } from 'astro';
import { z } from 'astro/zod';
import {
  WordPressClient,
  createJwtAuthHeader,
  wordPressErrorSchema,
  type JwtAuthCredentials,
  type JwtAuthTokenResponse,
  type WordPressAuthor,
} from 'fluent-wp-client';

const DEFAULT_COOKIE_NAME = 'wp_astro_auth';
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_COOKIE_SAME_SITE: 'lax' = 'lax';
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 12;
const loginUsernameOrEmailSchema = z.string().trim().min(1).max(320);

const jwtAuthTokenResponseSchema = z.object({
  token: z.string().trim().min(1),
  user_email: z.string().optional(),
  user_nicename: z.string().optional(),
  user_display_name: z.string().optional(),
});

const jwtAuthErrorSchema = z.object({
  code: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1),
  statusCode: z.number().int().optional(),
  data: z.object({
    status: z.number().int().optional(),
  }).optional(),
});

type JwtAuthErrorResponse = z.infer<typeof jwtAuthErrorSchema>;

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
 */
export interface WordPressAuthBridgeConfig {
  baseUrl: string;
  cookieName?: string;
  cookiePath?: string;
  cookieSameSite?: 'lax' | 'strict' | 'none';
  secureCookies?: boolean;
  sessionDurationSeconds?: number;
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
 * Return value of the packaged auth bridge factory used by Astro actions and middleware.
 */
export interface WordPressAuthBridge {
  cookieName: string;
  loginAction: WordPressLoginAction;
  getSession: (sessionId: string | undefined) => WordPressAuthSession | null;
  deleteSession: (sessionId: string | undefined) => void;
  clearCookie: (cookies: APIContext['cookies']) => void;
  clearAuthentication: (cookies: APIContext['cookies'], sessionId?: string | undefined) => void;
  resolveUserBySessionId: (sessionId: string | undefined) => Promise<WordPressAuthor | null>;
  getActionAuth: (context: Pick<ActionAPIContext, 'cookies'>) => JwtAuthCredentials | null;
  resolveUser: (context: Pick<APIContext, 'cookies'>) => Promise<WordPressAuthor | null>;
  isAuthenticated: (context: Pick<APIContext, 'cookies'>) => Promise<boolean>;
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
  const wpError = wordPressErrorSchema.safeParse(data);

  if (wpError.success) {
    return wpError.data.message;
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
 * Authenticates with the JWT plugin endpoint and returns one signed token.
 */
async function loginWithWordPressJwt(
  baseUrl: string,
  usernameOrEmail: string,
  password: string,
): Promise<string> {
  const client = new WordPressClient({
    baseUrl,
  });

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

    const parsedJwtError = jwtAuthErrorSchema.safeParse(responseBody);
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
async function resolveUserByToken(baseUrl: string, token: string): Promise<WordPressAuthor | null> {
  const client = new WordPressClient({
    baseUrl,
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
async function resolveLoggedInUser(baseUrl: string, token: string): Promise<WordPressAuthor> {
  const user = await resolveUserByToken(baseUrl, token);

  if (!user) {
    throw createInvalidSessionError();
  }

  return user;
}

/**
 * Creates a ready-to-use WordPress authentication bridge with a predefined login server action.
 */
export function createWordPressAuthBridge(config: WordPressAuthBridgeConfig): WordPressAuthBridge {
  const normalizedConfig = {
    ...config,
    cookieName: config.cookieName || DEFAULT_COOKIE_NAME,
    cookiePath: config.cookiePath || DEFAULT_COOKIE_PATH,
    cookieSameSite: config.cookieSameSite || DEFAULT_COOKIE_SAME_SITE,
    sessionDurationSeconds: config.sessionDurationSeconds || DEFAULT_SESSION_DURATION_SECONDS,
  };

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

    return resolveUserByToken(normalizedConfig.baseUrl, session.token);
  }

  /**
   * Creates JWT action auth config from the current request cookie value.
   */
  function getActionAuth(context: Pick<ActionAPIContext, 'cookies'>): JwtAuthCredentials | null {
    const sessionId = context.cookies.get(normalizedConfig.cookieName)?.value;
    const session = getSession(sessionId);

    if (!session) {
      return null;
    }

    return {
      token: session.token,
    };
  }

  /**
   * Resolves the authenticated user directly from middleware context.
   */
  async function resolveUser(context: Pick<APIContext, 'cookies'>): Promise<WordPressAuthor | null> {
    const sessionId = context.cookies.get(normalizedConfig.cookieName)?.value;
    return resolveUserBySessionId(sessionId);
  }

  /**
   * Checks whether the incoming request has one valid, usable user session.
   */
  async function isAuthenticated(context: Pick<APIContext, 'cookies'>): Promise<boolean> {
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
        normalizedConfig.baseUrl,
        input.usernameOrEmail,
        input.password,
      );

      const session = getSession(token);

      if (!session) {
        throw createInvalidSessionError();
      }

      const user = await resolveLoggedInUser(normalizedConfig.baseUrl, session.token);

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
    loginAction,
    getSession,
    deleteSession,
    clearCookie,
    clearAuthentication,
    resolveUserBySessionId,
    getActionAuth,
    resolveUser,
    isAuthenticated,
  };
}
