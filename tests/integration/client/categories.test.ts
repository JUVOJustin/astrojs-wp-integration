import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

/**
 * Seed data: 5 custom categories (Technology, Science, Travel, Food, Health)
 * plus the default "Uncategorized" = 6 total.
 */
describe('Client: Categories', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
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

  it('getCategoryBySlug fetches a known seed category', async () => {
    const category = await client.getCategoryBySlug('technology');

    expect(category).toBeDefined();
    expect(category!.slug).toBe('technology');
    expect(category!.name).toBe('Technology');
    expect(category!.count).toBe(30);
  });

  it('getCategoryBySlug returns undefined for non-existent slug', async () => {
    const category = await client.getCategoryBySlug('nonexistent-cat-999');

    expect(category).toBeUndefined();
  });

  it('getAllCategories returns all 6 categories', async () => {
    const all = await client.getAllCategories();

    expect(all).toHaveLength(6);

    const slugs = all.map((c) => c.slug).sort();
    expect(slugs).toContain('technology');
    expect(slugs).toContain('science');
    expect(slugs).toContain('travel');
    expect(slugs).toContain('food');
    expect(slugs).toContain('health');
    expect(slugs).toContain('uncategorized');
  });

  it('getCategoriesPaginated returns pagination metadata', async () => {
    const result = await client.getCategoriesPaginated({ perPage: 2, page: 1 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(6);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });
});
