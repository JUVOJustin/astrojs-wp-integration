import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

/**
 * Seed data: 8 tags (featured, trending, tutorial, review, guide, news, opinion, update).
 */
describe('Client: Tags', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
  });

  it('getTags returns an array', async () => {
    const tags = await client.getTags();

    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });

  it('every tag has required fields', async () => {
    const tags = await client.getTags();

    for (const tag of tags) {
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('slug');
      expect(tag).toHaveProperty('count');
      expect(tag).toHaveProperty('taxonomy');
      expect(tag.taxonomy).toBe('post_tag');
    }
  });

  it('getTagBySlug fetches a known seed tag', async () => {
    const tag = await client.getTagBySlug('featured');

    expect(tag).toBeDefined();
    expect(tag!.slug).toBe('featured');
    expect(tag!.name).toBe('Featured');
    // "featured" is assigned to Technology (30) + Health (30) = 60 posts
    expect(tag!.count).toBe(60);
  });

  it('getTagBySlug returns undefined for non-existent slug', async () => {
    const tag = await client.getTagBySlug('nonexistent-tag-999');

    expect(tag).toBeUndefined();
  });

  it('getAllTags returns all 8 tags', async () => {
    const all = await client.getAllTags();

    expect(all).toHaveLength(8);

    const slugs = all.map((t) => t.slug).sort();
    expect(slugs).toEqual([
      'featured', 'guide', 'news', 'opinion',
      'review', 'trending', 'tutorial', 'update',
    ]);
  });

  it('getTagsPaginated returns pagination metadata', async () => {
    const result = await client.getTagsPaginated({ perPage: 3, page: 1 });

    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(8);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });
});
