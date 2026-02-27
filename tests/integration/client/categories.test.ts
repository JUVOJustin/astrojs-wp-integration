import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

describe('Client: Categories', () => {
  let client: WordPressClient;
  let seededCategoryIds: number[];

  beforeAll(() => {
    client = createPublicClient();
    seededCategoryIds = (process.env.WP_SEEDED_CATEGORY_IDS || '').split(',').map(Number);
  });

  it('getCategories returns an array', async () => {
    const categories = await client.getCategories();

    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('every category has required fields', async () => {
    const categories = await client.getCategories();

    for (const cat of categories) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('slug');
      expect(cat).toHaveProperty('count');
      expect(cat).toHaveProperty('taxonomy');
      expect(cat.taxonomy).toBe('category');
    }
  });

  it('getCategory fetches a single category by ID', async () => {
    const category = await client.getCategory(seededCategoryIds[0]);

    expect(category.id).toBe(seededCategoryIds[0]);
    expect(category.name).toBe('Test Category');
  });

  it('getCategoryBySlug fetches by slug', async () => {
    const category = await client.getCategoryBySlug('test-category');

    expect(category).toBeDefined();
    expect(category!.slug).toBe('test-category');
  });

  it('getCategoryBySlug returns undefined for non-existent slug', async () => {
    const category = await client.getCategoryBySlug('nonexistent-cat-999');

    expect(category).toBeUndefined();
  });

  it('getAllCategories returns all categories', async () => {
    const all = await client.getAllCategories();

    expect(all.length).toBeGreaterThanOrEqual(seededCategoryIds.length);
    for (const id of seededCategoryIds) {
      expect(all.some((c) => c.id === id)).toBe(true);
    }
  });

  it('getCategoriesPaginated returns pagination metadata', async () => {
    const result = await client.getCategoriesPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.page).toBe(1);
  });
});
