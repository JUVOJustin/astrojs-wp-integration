import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient, createAuthClient } from '../../helpers/wp-client';

describe('Client: Settings', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  it('getSettings returns site settings when authenticated', async () => {
    const settings = await authClient.getSettings();

    expect(settings).toHaveProperty('title');
    expect(settings).toHaveProperty('description');
    expect(settings).toHaveProperty('url');
    expect(settings).toHaveProperty('timezone');
    expect(settings).toHaveProperty('language');
    expect(settings).toHaveProperty('posts_per_page');
    expect(typeof settings.posts_per_page).toBe('number');
  });

  it('getSettings throws without auth', async () => {
    await expect(publicClient.getSettings()).rejects.toThrow('Authentication required');
  });
});
