import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';
import { createWordPressAuthBridge } from '../../../src/server/auth';
import { createCookieAuthClient, getBaseUrl } from '../../helpers/wp-client';

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

  it('decodes one JWT token without relying on the Node Buffer global', () => {
    const originalBuffer = globalThis.Buffer;
    Reflect.set(globalThis as object, 'Buffer', undefined);

    try {
      const session = bridge.getSession(token);

      expect(session).not.toBeNull();
      expect(session?.token).toBe(token);
    } finally {
      Reflect.set(globalThis as object, 'Buffer', originalBuffer);
    }
  });

  it('resolves the authenticated user from one JWT session token', async () => {
    const user = await bridge.resolveUserBySessionId(token);

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('returns null when the JWT session token is invalid', async () => {
    const tokenParts = token.split('.');
    const invalidToken = `${tokenParts[0]}.${tokenParts[1]}.invalid-signature`;
    const user = await bridge.resolveUserBySessionId(invalidToken);

    expect(user).toBeNull();
  });

  it('surfaces transport errors while resolving the authenticated user', async () => {
    const unreachableBridge = createWordPressAuthBridge({ baseUrl: 'http://127.0.0.1:9' });

    await expect(unreachableBridge.resolveUserBySessionId(token)).rejects.toThrow();
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

  it('matches the wp-env JWT endpoint auth failure status for invalid credentials', async () => {
    const response = await fetch(`${getBaseUrl()}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'definitely-wrong',
      }),
    });
    const data = await response.json() as {
      code?: string;
      data?: { status?: number };
    };

    expect(response.status).toBe(403);
    expect(data.code).toBe('[jwt_auth] incorrect_password');
    expect(data.data?.status).toBe(403);
  });

  it('authenticates one client using the seeded cookie + nonce session', async () => {
    const client = createCookieAuthClient();
    const user = await client.getCurrentUser();

    expect(user.slug).toBe('admin');
  });
});
