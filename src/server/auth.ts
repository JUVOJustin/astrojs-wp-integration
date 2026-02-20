import { ActionError, defineAction } from 'astro/actions/runtime/server.js';
import type { APIContext } from 'astro';
import { z } from 'astro/zod';
import { WordPressClient } from '../client';
import type { BasicAuthCredentials } from '../client/auth';
import { wordPressUserLoader } from '../loaders/live';
import type { WordPressAuthor } from '../schemas';

const DEFAULT_COOKIE_NAME = 'wp_astro_auth';
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_COOKIE_SAME_SITE: 'lax' = 'lax';
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 12;

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
    email: z.string().trim().email(),
    password: z.string().min(1).max(512),
    redirectTo: z.string().optional(),
  })
  .strict();

/**
 * Type-safe login payload inferred directly from the login input schema.
 */
export type WordPressLoginInput = z.infer<typeof wordPressLoginInputSchema>;

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
 */
export interface WordPressAuthSession {
  id: string;
  userId: number;
  credentials: BasicAuthCredentials;
  expiresAt: number;
}

/**
 * Return value of the packaged auth bridge factory used by Astro actions and middleware.
 */
export interface WordPressAuthBridge {
  cookieName: string;
  loginAction: ReturnType<typeof defineAction>;
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
  function createSession(userId: number, credentials: BasicAuthCredentials): WordPressAuthSession {
    const session: WordPressAuthSession = {
      id: crypto.randomUUID(),
      userId,
      credentials,
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
      auth: session.credentials,
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

  const loginAction = defineAction({
    accept: 'json',
    input: wordPressLoginInputSchema,
    handler: async (input, context) => {
      const credentials: BasicAuthCredentials = {
        username: input.email,
        password: input.password,
      };

      const client = new WordPressClient({
        baseUrl: normalizedConfig.baseUrl,
        auth: credentials,
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

      const session = createSession(user.id, credentials);

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
