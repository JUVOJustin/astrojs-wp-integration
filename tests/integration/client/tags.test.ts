import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

describe('Client: Tags', () => {
  let client: WordPressClient;
  let seededTagIds: number[];

  beforeAll(() => {
    client = createPublicClient();
    seededTagIds = (process.env.WP_SEEDED_TAG_IDS || '').split(',').map(Number);
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

  it('getTag fetches a single tag by ID', async () => {
    const tag = await client.getTag(seededTagIds[0]);

    expect(tag.id).toBe(seededTagIds[0]);
    expect(tag.name).toBe('Test Tag');
  });

  it('getTagBySlug fetches by slug', async () => {
    const tag = await client.getTagBySlug('test-tag');

    expect(tag).toBeDefined();
    expect(tag!.slug).toBe('test-tag');
  });

  it('getTagBySlug returns undefined for non-existent slug', async () => {
    const tag = await client.getTagBySlug('nonexistent-tag-999');

    expect(tag).toBeUndefined();
  });

  it('getAllTags returns all tags', async () => {
    const all = await client.getAllTags();

    expect(all.length).toBeGreaterThanOrEqual(seededTagIds.length);
    for (const id of seededTagIds) {
      expect(all.some((t) => t.id === id)).toBe(true);
    }
  });

  it('getTagsPaginated returns pagination metadata', async () => {
    const result = await client.getTagsPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.page).toBe(1);
  });
});
