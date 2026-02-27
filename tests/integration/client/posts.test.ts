import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

/**
 * Seed data: 150 posts across 5 categories (30 each).
 * Slugs: test-post-001 through test-post-150.
 * WP REST API caps per_page at 100, so getAllPosts() must paginate.
 */
describe('Client: Posts', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
  });

  it('getPosts returns an array of posts', async () => {
    const posts = await client.getPosts();

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it('every post has required fields', async () => {
    const posts = await client.getPosts();

    for (const post of posts) {
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title.rendered');
      expect(post).toHaveProperty('content.rendered');
      expect(post).toHaveProperty('excerpt.rendered');
      expect(post).toHaveProperty('date');
      expect(post).toHaveProperty('status');
    }
  });

  it('getPostBySlug fetches a known seed post', async () => {
    const post = await client.getPostBySlug('test-post-001');

    expect(post).toBeDefined();
    expect(post!.slug).toBe('test-post-001');
    expect(post!.title.rendered).toBe('Test Post 001');
  });

  it('getPostBySlug returns undefined for non-existent slug', async () => {
    const post = await client.getPostBySlug('this-slug-does-not-exist-999');

    expect(post).toBeUndefined();
  });

  it('getAllPosts returns all 150 seed posts (multi-page fetch)', async () => {
    const all = await client.getAllPosts();

    expect(all).toHaveLength(150);
  });

  it('getPostsPaginated returns correct pagination metadata', async () => {
    const result = await client.getPostsPaginated({ perPage: 100, page: 1 });

    expect(result.data).toHaveLength(100);
    expect(result.total).toBe(150);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(100);
  });

  it('getPostsPaginated page 2 returns remaining posts', async () => {
    const result = await client.getPostsPaginated({ perPage: 100, page: 2 });

    expect(result.data).toHaveLength(50);
    expect(result.total).toBe(150);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(2);
  });

  it('getPosts respects ordering', async () => {
    const asc = await client.getPosts({ orderby: 'title', order: 'asc' });
    const desc = await client.getPosts({ orderby: 'title', order: 'desc' });

    expect(asc[0].title.rendered).not.toBe(desc[0].title.rendered);
  });

  it('getPosts embeds featured media data', async () => {
    const posts = await client.getPosts();

    for (const post of posts) {
      expect(post).toHaveProperty('_embedded');
    }
  });
});
