import { describe, it, expect } from 'vitest';
import { callAction } from '../../helpers/action-client';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Creates one expired JWT-like token for bridge fallback tests.
 */
function createExpiredToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) - 60,
    data: { user: { id: 1 } },
  })).toString('base64url');

  return `${header}.${payload}.expired-signature`;
}

/**
 * Integration tests for the packaged JWT auth bridge middleware/action helpers.
 */
describe('Actions: Auth Bridge', () => {
  const token = process.env.WP_JWT_TOKEN!;

  it('decodes one JWT token into a valid session object', async () => {
    const session = await callAction<{ token: string; authHeader: string }>('authBridgeGetSession', { token });

    expect(session).not.toBeNull();
    expect(session.token).toBe(token);
    expect(session.authHeader.startsWith('Bearer ')).toBe(true);
  });

  it('decodes one JWT token without relying on the Node Buffer global', async () => {
    const session = await callAction<{ token: string }>('authBridgeGetSessionWithoutBuffer', { token });

    expect(session).not.toBeNull();
    expect(session.token).toBe(token);
  });

  it('resolves the authenticated user from one JWT session token', async () => {
    const user = await callAction<{ slug: string } | null>('authBridgeResolveUserBySessionId', { token });

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('returns null when the JWT session token is invalid', async () => {
    const tokenParts = token.split('.');
    const invalidToken = `${tokenParts[0]}.${tokenParts[1]}.invalid-signature`;
    const user = await callAction<{ slug: string } | null>('authBridgeResolveUserBySessionId', {
      token: invalidToken,
    });

    expect(user).toBeNull();
  });

  it('surfaces transport errors while resolving the authenticated user', async () => {
    await expect(
      callAction('authBridgeResolveUserBySessionIdUnreachable', { token }),
    ).rejects.toThrow();
  });

  it('resolves middleware user context from cookie-backed JWT session', async () => {
    const user = await callAction<{ slug: string } | null>('authBridgeResolveUser', { token });

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('reports unauthenticated state when cookie token is missing', async () => {
    const authenticated = await callAction<boolean>('authBridgeIsAuthenticated', {});

    expect(authenticated).toBe(false);
  });

  it('treats expired cookie-backed JWT sessions as unauthenticated', async () => {
    const authenticated = await callAction<boolean>('authBridgeIsAuthenticated', {
      token: createExpiredToken(),
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

  it('reports authenticated state when cookie token is present', async () => {
    const authenticated = await callAction<boolean>('authBridgeIsAuthenticated', { token });

    expect(authenticated).toBe(true);
  });

  it('ignores static bridge auth while resolving request user state', async () => {
    const user = await callAction<{ slug: string } | null>('authBridgeResolveUserIgnoringStaticFallback', {
      token: createExpiredToken(),
    });

    expect(user).toBeNull();
  });

  it('allows explicit static auth fallback when requesting a client', async () => {
    const user = await callAction<{ slug: string } | null>('authBridgeResolveUserWithOptInStaticFallback', {
      token: createExpiredToken(),
    });

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });

  it('lets per-call authHeaders override bridge-level authHeaders', async () => {
    const user = await callAction<{ slug: string } | null>('authBridgeRespectsPerCallAuthHeaders', {});

    expect(user).not.toBeNull();
    expect(user?.slug).toBe('admin');
  });
});
