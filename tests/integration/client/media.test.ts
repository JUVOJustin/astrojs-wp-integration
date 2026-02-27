import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

/**
 * Seed data contains no media items. Tests verify the client handles
 * empty collections and error cases correctly.
 */
describe('Client: Media', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
  });

  it('getMedia returns an empty array when no media exists', async () => {
    const media = await client.getMedia();

    expect(Array.isArray(media)).toBe(true);
    expect(media).toHaveLength(0);
  });

  it('getAllMedia returns an empty array when no media exists', async () => {
    const media = await client.getAllMedia();

    expect(Array.isArray(media)).toBe(true);
    expect(media).toHaveLength(0);
  });

  it('getMediaPaginated returns pagination metadata with zero results', async () => {
    const result = await client.getMediaPaginated({ perPage: 1, page: 1 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('totalPages');
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(1);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('getMediaItem throws for non-existent ID', async () => {
    await expect(client.getMediaItem(999999)).rejects.toThrow();
  });

  it('getMediaBySlug returns undefined for non-existent slug', async () => {
    const item = await client.getMediaBySlug('nonexistent-media-999');

    expect(item).toBeUndefined();
  });
});
