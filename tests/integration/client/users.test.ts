import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createJwtAuthHeader } from '../../../src/client/auth';
import { createPublicClient, createAuthClient, createJwtAuthClient } from '../../helpers/wp-client';

/**
 * The seed data has a single admin user. Tests cover both public and
 * authenticated user endpoints.
 */
describe('Client: Users', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let jwtClient: WordPressClient;
  let requestSignedClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
    jwtClient = createJwtAuthClient();
    requestSignedClient = new WordPressClient({
      baseUrl: process.env.WP_BASE_URL!,
      authHeaders: ({ method, url }) => {
        if (method !== 'GET') {
          throw new Error('Expected GET for users endpoint test.');
        }

        if (!url.pathname.endsWith('/wp-json/wp/v2/users/me')) {
          throw new Error('Expected /users/me endpoint for auth header provider test.');
        }

        return {
          Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
        };
      },
    });
  });

  it('getUsers returns an array of users', async () => {
    const users = await publicClient.getUsers();

    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
  });

  it('every user has required fields', async () => {
    const users = await publicClient.getUsers();

    for (const user of users) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('slug');
      expect(user).toHaveProperty('link');
      expect(user).toHaveProperty('avatar_urls');
    }
  });

  it('getUser fetches a single user by ID', async () => {
    const users = await publicClient.getUsers();
    const user = await publicClient.getUser(users[0].id);

    expect(user.id).toBe(users[0].id);
    expect(user.slug).toBe('admin');
  });

  it('getAllUsers auto-paginates', async () => {
    const all = await publicClient.getAllUsers();

    expect(all).toHaveLength(1);
  });

  it('getUsersPaginated returns pagination metadata', async () => {
    const result = await publicClient.getUsersPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('getCurrentUser returns the authenticated admin user', async () => {
    const me = await authClient.getCurrentUser();

    expect(me).toHaveProperty('id');
    expect(me.slug).toBe('admin');
  });

  it('getCurrentUser also works with JWT auth config', async () => {
    const me = await jwtClient.getCurrentUser();

    expect(me).toHaveProperty('id');
    expect(me.slug).toBe('admin');
  });

  it('getCurrentUser also works with request-aware auth header provider', async () => {
    const me = await requestSignedClient.getCurrentUser();

    expect(me).toHaveProperty('id');
    expect(me.slug).toBe('admin');
  });

  it('getCurrentUser throws without auth', async () => {
    await expect(publicClient.getCurrentUser()).rejects.toThrow('Authentication required');
  });
});
