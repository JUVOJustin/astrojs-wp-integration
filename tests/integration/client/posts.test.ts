import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

describe('Client: Posts', () => {
  let client: WordPressClient;
  let seededPostIds: number[];

  beforeAll(() => {
    client = createPublicClient();
    seededPostIds = (process.env.WP_SEEDED_POST_IDS || '').split(',').map(Number);
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

  it('getPost fetches a single post by ID', async () => {
    const post = await client.getPost(seededPostIds[0]);

    expect(post.id).toBe(seededPostIds[0]);
    expect(post.title.rendered).toContain('Test Post');
  });

  it('getPostBySlug fetches a post by slug', async () => {
    const posts = await client.getPosts();
    const slug = posts[0].slug;

    const post = await client.getPostBySlug(slug);

    expect(post).toBeDefined();
    expect(post!.slug).toBe(slug);
  });

  it('getPostBySlug returns undefined for non-existent slug', async () => {
    const post = await client.getPostBySlug('this-slug-does-not-exist-999');

    expect(post).toBeUndefined();
  });

  it('getAllPosts returns every published post', async () => {
    const all = await client.getAllPosts();

    expect(all.length).toBeGreaterThanOrEqual(seededPostIds.length);
    for (const id of seededPostIds) {
      expect(all.some((p) => p.id === id)).toBe(true);
    }
  });

  it('getPostsPaginated returns pagination metadata', async () => {
    const result = await client.getPostsPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(1);
  });

  it('getPosts respects ordering', async () => {
    const asc = await client.getPosts({ orderby: 'title', order: 'asc' });
    const desc = await client.getPosts({ orderby: 'title', order: 'desc' });

    if (asc.length > 1) {
      expect(asc[0].title.rendered).not.toBe(desc[0].title.rendered);
    }
  });

  it('getPosts embeds featured media data', async () => {
    const posts = await client.getPosts();

    // _embedded should be present due to the _embed param the client passes
    for (const post of posts) {
      expect(post).toHaveProperty('_embedded');
    }
  });
});
