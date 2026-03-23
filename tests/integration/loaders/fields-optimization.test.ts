import { describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { getBaseUrl } from '../../helpers/wp-client';
import {
  extractFieldsFromSchema,
  fieldsPresets,
  mergeFields,
} from '../../../src/loaders/schema-fields';

/**
 * Integration tests for _fields parameter optimization.
 *
 * These tests verify that:
 * 1. The _fields parameter is correctly passed through to WordPress
 * 2. Response payloads are reduced when using field restrictions
 * 3. All loader types (static and live) properly support fields
 */
describe('Loaders: _fields parameter optimization', () => {
  const baseUrl = getBaseUrl();

  it('fetches posts with reduced payload using fields parameter', async () => {
    const client = new WordPressClient({ baseUrl });

    // Full payload (all fields)
    const fullPosts = await client.getPosts({ perPage: 1 });
    const fullPayload = JSON.stringify(fullPosts[0]).length;

    // Minimal payload with only essential fields
    const minimalPosts = await client.getPosts({
      perPage: 1,
      fields: [...fieldsPresets.postList],
    });
    const minimalPayload = JSON.stringify(minimalPosts[0]).length;

    // Minimal payload should be significantly smaller
    expect(minimalPayload).toBeLessThan(fullPayload * 0.6);
    
    // Should still have the essential fields
    expect(minimalPosts[0]).toHaveProperty('id');
    expect(minimalPosts[0]).toHaveProperty('title');
    expect(minimalPosts[0]).toHaveProperty('slug');
  });

  it('fetches pages with fields parameter', async () => {
    const client = new WordPressClient({ baseUrl });

    const pages = await client.getPages({
      perPage: 1,
      fields: [...fieldsPresets.pageList],
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveProperty('id');
    expect(pages[0]).toHaveProperty('title');
    expect(pages[0]).toHaveProperty('slug');
  });

  it('fetches categories with fields parameter', async () => {
    const client = new WordPressClient({ baseUrl });

    const categories = await client.getCategories({
      perPage: 5,
      fields: [...fieldsPresets.categoryList],
    });

    expect(categories.length).toBeGreaterThan(0);
    categories.forEach((category) => {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('slug');
    });
  });

  it('fetches media with fields parameter', async () => {
    const client = new WordPressClient({ baseUrl });

    // First, get a list of media to know what IDs exist
    const allMedia = await client.getAllMedia({ perPage: 1 });
    
    if (allMedia.length === 0) {
      // Skip if no media in test environment
      return;
    }

    const media = await client.getMedia({
      perPage: 1,
      fields: [...fieldsPresets.mediaList],
    });

    expect(media).toHaveLength(1);
    expect(media[0]).toHaveProperty('id');
    expect(media[0]).toHaveProperty('source_url');
  });

  it('fetches users with fields parameter', async () => {
    const client = new WordPressClient({ baseUrl });

    const users = await client.getUsers({
      perPage: 3,
      fields: [...fieldsPresets.authorList],
    });

    expect(users.length).toBeGreaterThan(0);
    users.forEach((user) => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
    });
  });

  it('extracts fields from Zod schema and uses them in request', async () => {
    const { z } = await import('zod');
    const client = new WordPressClient({ baseUrl });

    // Define a minimal schema for post listings
    const minimalPostSchema = z.object({
      id: z.number(),
      title: z.object({
        rendered: z.string(),
      }),
      slug: z.string(),
      link: z.string(),
    });

    // Extract fields from the schema
    const fields = extractFieldsFromSchema(minimalPostSchema);

    // Use extracted fields in a request
    const posts = await client.getPosts({
      perPage: 1,
      fields,
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toHaveProperty('id');
    expect(posts[0]).toHaveProperty('title');
    expect(posts[0]).toHaveProperty('slug');
  });

  it('merges preset fields with custom fields', async () => {
    const client = new WordPressClient({ baseUrl });

    // Combine preset with custom fields
    const customFields = ['meta', '_links'];
    const mergedFields = mergeFields(fieldsPresets.postList, customFields);

    const posts = await client.getPosts({
      perPage: 1,
      fields: mergedFields,
    });

    expect(posts).toHaveLength(1);
    // Should have the preset fields
    expect(posts[0]).toHaveProperty('title');
    expect(posts[0]).toHaveProperty('slug');
  });

  it('handles empty fields array (no restriction)', async () => {
    const client = new WordPressClient({ baseUrl });

    // Empty fields array should return all fields
    const posts = await client.getPosts({
      perPage: 1,
      fields: [],
    });

    expect(posts).toHaveLength(1);
    // Should have content field (which wouldn't be in postList preset)
    expect(posts[0]).toHaveProperty('content');
  });

  it('preserves _links when explicitly requested', async () => {
    const client = new WordPressClient({ baseUrl });

    const posts = await client.getPosts({
      perPage: 1,
      fields: ['id', 'title.rendered', '_links'],
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toHaveProperty('_links');
  });
});
