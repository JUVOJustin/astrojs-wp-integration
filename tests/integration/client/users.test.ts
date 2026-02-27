import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient, createAuthClient } from '../../helpers/wp-client';

describe('Client: Users', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  it('getUsers returns an array of users', async () => {
    const users = await publicClient.getUsers();

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
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
  });

  it('getAllUsers auto-paginates', async () => {
    const all = await publicClient.getAllUsers();

    expect(all.length).toBeGreaterThan(0);
  });

  it('getUsersPaginated returns pagination metadata', async () => {
    const result = await publicClient.getUsersPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.page).toBe(1);
  });

  it('getCurrentUser returns the authenticated admin user', async () => {
    const me = await authClient.getCurrentUser();

    expect(me).toHaveProperty('id');
    expect(me.slug).toBe('admin');
  });

  it('getCurrentUser throws without auth', async () => {
    await expect(publicClient.getCurrentUser()).rejects.toThrow('Authentication required');
  });
});
