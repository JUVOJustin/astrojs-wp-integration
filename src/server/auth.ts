import {
  ActionError,
  defineAction,
  type ActionAPIContext,
  type ActionClient,
} from 'astro/actions/runtime/server.js';
import type { APIContext } from 'astro';
import { z } from 'astro/zod';
import { WordPressClient } from '../client';
import { wordPressUserLoader } from '../loaders/live';
import type { WordPressAuthor } from '../schemas';

const DEFAULT_COOKIE_NAME = 'wp_astro_auth';
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_COOKIE_SAME_SITE: 'lax' = 'lax';
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 12;
const WORDPRESS_LOGIN_PATH = '/wp-login.php';
const WORDPRESS_ADMIN_PATH = '/wp-admin/';
const WORDPRESS_TEST_COOKIE_NAME = 'wordpress_test_cookie';
const WORDPRESS_TEST_COOKIE_VALUE = 'WP Cookie check';

const loginUsernameOrEmailSchema = z.string().trim().min(1).max(320);

type UserLoaderEntryInput = Parameters<ReturnType<typeof wordPressUserLoader>['loadEntry']>[0];

type UserLoaderResult = {
  data?: WordPressAuthor;
  error?: Error;
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
 * In-memory authentication session for one logged-in WordPress user.
 * Stores the WordPress session cookies used for REST API requests.
 */
export interface WordPressAuthSession {
  id: string;
  userId: number;
  cookies: string;
  expiresAt: number;
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
  clearAuthentication: (cookies: APIContext['cookies'], sessionId: string | undefined) => void;
  resolveUserBySessionId: (sessionId: string | undefined) => Promise<WordPressAuthor | null>;
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
 * Validates a session timestamp and ensures expired sessions are treated as invalid.
 */
function isSessionExpired(session: WordPressAuthSession): boolean {
  return session.expiresAt <= Date.now();
}

/**
 * Builds a WordPress URL by appending a suffix to the configured base URL.
 */
function buildWordPressURL(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/$/, '')}${suffix}`;
}

/**
 * Splits a combined Set-Cookie header into individual cookie strings.
 */
function splitSetCookieHeader(headerValue: string): string[] {
  return headerValue
    .split(/,(?=[^;]+?=)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Extracts Set-Cookie header values from a fetch response.
 */
function extractSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as unknown as { getSetCookie?: () => string[] };

  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const setCookieHeader = response.headers.get('set-cookie');

  if (!setCookieHeader) {
    return [];
  }

  return splitSetCookieHeader(setCookieHeader);
}

/**
 * Converts Set-Cookie header values into a Cookie header string.
 */
function toCookieHeader(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Merges multiple Cookie header strings into a single normalized header value.
 */
function mergeCookieHeaders(...headers: Array<string | undefined>): string {
  const cookieMap = new Map<string, string>();

  for (const header of headers) {
    if (!header) {
      continue;
    }

    const parts = header.split(';');

    for (const part of parts) {
      const trimmed = part.trim();

      if (!trimmed) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!name) {
        continue;
      }

      cookieMap.set(name, value);
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Checks whether the cookie header contains a WordPress logged-in cookie.
 */
function hasWordPressLoginCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith('wordpress_logged_in_') || part.startsWith('wordpress_sec_'));
}

/**
 * Authenticates against the WordPress login form and returns the session cookies.
 */
async function loginWithWordPressForm(
  baseUrl: string,
  usernameOrEmail: string,
  password: string,
): Promise<string> {
  const loginUrl = buildWordPressURL(baseUrl, WORDPRESS_LOGIN_PATH);
  const adminUrl = buildWordPressURL(baseUrl, WORDPRESS_ADMIN_PATH);

  const initialResponse = await fetch(loginUrl, { redirect: 'manual' });
  const initialCookies = toCookieHeader(extractSetCookieHeaders(initialResponse));
  const testCookieHeader = `${WORDPRESS_TEST_COOKIE_NAME}=${WORDPRESS_TEST_COOKIE_VALUE}`;
  const initialCookieHeader = mergeCookieHeaders(testCookieHeader, initialCookies);

  const body = new URLSearchParams({
    log: usernameOrEmail,
    pwd: password,
    redirect_to: adminUrl,
    rememberme: 'forever',
    'wp-submit': 'Log In',
    testcookie: '1',
  });

  const loginResponse = await fetch(loginUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(initialCookieHeader ? { Cookie: initialCookieHeader } : {}),
    },
    body: body.toString(),
  });

  const loginCookies = toCookieHeader(extractSetCookieHeaders(loginResponse));
  const mergedCookieHeader = mergeCookieHeaders(initialCookieHeader, loginCookies);

  if (!mergedCookieHeader || !hasWordPressLoginCookie(mergedCookieHeader)) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'WordPress rejected these credentials.',
    });
  }

  return mergedCookieHeader;
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

  const sessionStore = new Map<string, WordPressAuthSession>();

  /**
   * Creates one in-memory session record and returns its generated token details.
   */
  function createSession(userId: number, cookies: string): WordPressAuthSession {
    const session: WordPressAuthSession = {
      id: crypto.randomUUID(),
      userId,
      cookies,
      expiresAt: Date.now() + normalizedConfig.sessionDurationSeconds * 1000,
    };

    sessionStore.set(session.id, session);

    return session;
  }

  /**
   * Reads one session from memory and drops it immediately when the session is expired.
   */
  function getSession(sessionId: string | undefined): WordPressAuthSession | null {
    if (!sessionId) {
      return null;
    }

    const session = sessionStore.get(sessionId);

    if (!session) {
      return null;
    }

    if (!isSessionExpired(session)) {
      return session;
    }

    sessionStore.delete(sessionId);

    return null;
  }

  /**
   * Removes a session token from memory when a user signs out or a session becomes invalid.
   */
  function deleteSession(sessionId: string | undefined): void {
    if (!sessionId) {
      return;
    }

    sessionStore.delete(sessionId);
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
   * Clears both in-memory session state and browser cookie for one authentication context.
   */
  function clearAuthentication(cookies: APIContext['cookies'], sessionId: string | undefined): void {
    deleteSession(sessionId);
    clearCookie(cookies);
  }

  /**
   * Resolves the authenticated WordPress user by session token via the dynamic user loader.
   */
  async function resolveUserBySessionId(sessionId: string | undefined): Promise<WordPressAuthor | null> {
    const session = getSession(sessionId);

    if (!session) {
      return null;
    }

    const loader = wordPressUserLoader({
      baseUrl: normalizedConfig.baseUrl,
      cookies: session.cookies,
    });

    const result = (await loader.loadEntry({
      filter: {
        id: session.userId,
      },
    } as UserLoaderEntryInput)) as UserLoaderResult;

    if (result.error || !result.data) {
      deleteSession(session.id);
      return null;
    }

    return result.data;
  }

  const loginAction: WordPressLoginAction = defineAction({
    accept: 'form',
    input: wordPressLoginInputSchema,
    handler: async (
      input: WordPressLoginInput,
      context: ActionAPIContext,
    ): Promise<WordPressLoginActionResult> => {
      const cookieHeader = await loginWithWordPressForm(
        normalizedConfig.baseUrl,
        input.usernameOrEmail,
        input.password,
      );

      const client = new WordPressClient({
        baseUrl: normalizedConfig.baseUrl,
        cookies: cookieHeader,
      });

      let user: WordPressAuthor;

      try {
        user = await client.getCurrentUser();
      } catch {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'WordPress rejected these credentials.',
        });
      }

      const session = createSession(user.id, cookieHeader);

      context.cookies.set(normalizedConfig.cookieName, session.id, {
        path: normalizedConfig.cookiePath,
        httpOnly: true,
        sameSite: normalizedConfig.cookieSameSite,
        secure: normalizedConfig.secureCookies ?? context.url.protocol === 'https:',
        maxAge: normalizedConfig.sessionDurationSeconds,
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
  };
}
