import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

describe('Client: Media', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
  });

  it('getMedia returns an array', async () => {
    const media = await client.getMedia();

    // Fresh WP may have no media — that is OK, we just verify the shape
    expect(Array.isArray(media)).toBe(true);
  });

  it('getAllMedia returns an array', async () => {
    const media = await client.getAllMedia();

    expect(Array.isArray(media)).toBe(true);
  });

  it('getMediaPaginated returns pagination metadata', async () => {
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
