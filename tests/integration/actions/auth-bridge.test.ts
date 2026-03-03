import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';
import { createWordPressAuthBridge } from '../../../src/server/auth';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Creates one cookie stub that optionally exposes a session token.
 */
function createCookieStub(cookieName: string, token: string | undefined): APIContext['cookies'] {
  return {
    get: (name: string) => {
      if (name !== cookieName || !token) {
        return undefined;
      }

      return { value: token };
    },
  } as unknown as APIContext['cookies'];
}

/**
 * Integration tests for the packaged JWT auth bridge middleware/action helpers.
 */
describe('Actions: Auth Bridge', () => {
  const token = process.env.WP_JWT_TOKEN!;
  const bridge = createWordPressAuthBridge({ baseUrl: getBaseUrl() });

  it('decodes one JWT token into a valid session object', () => {
    const session = bridge.getSession(token);

    expect(session).not.toBeNull();
    expect(session?.token).toBe(token);
    expect(session?.authHeader.startsWith('Bearer ')).toBe(true);
  });

  it('resolves the authenticated user from one JWT session token', async () => {
    const user = await bridge.resolveUserBySessionId(token);

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('returns JWT auth config for action handlers', () => {
    const actionAuth = bridge.getActionAuth({
      cookies: createCookieStub(bridge.cookieName, token),
    });

    expect(actionAuth).toEqual({ token });
  });

  it('resolves middleware user context from cookie-backed JWT session', async () => {
    const user = await bridge.resolveUser({
      cookies: createCookieStub(bridge.cookieName, token),
    });

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('reports unauthenticated state when cookie token is missing', async () => {
    const authenticated = await bridge.isAuthenticated({
      cookies: createCookieStub(bridge.cookieName, undefined),
    });

    expect(authenticated).toBe(false);
  });
});
