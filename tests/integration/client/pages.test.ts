import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

/**
 * Seed data: 10 pages (About, Contact, Services, FAQ, Team, Blog, Portfolio,
 * Testimonials, Privacy Policy, Terms of Service).
 */
describe('Client: Pages', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createPublicClient();
  });

  it('getPages returns an array of pages', async () => {
    const pages = await client.getPages();

    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
  });

  it('every page has required fields', async () => {
    const pages = await client.getPages();

    for (const page of pages) {
      expect(page).toHaveProperty('id');
      expect(page).toHaveProperty('slug');
      expect(page).toHaveProperty('title.rendered');
      expect(page).toHaveProperty('content.rendered');
      expect(page).toHaveProperty('date');
      expect(page).toHaveProperty('status');
      expect(page).toHaveProperty('parent');
      expect(page).toHaveProperty('menu_order');
    }
  });

  it('getPageBySlug fetches a known seed page', async () => {
    const page = await client.getPageBySlug('about');

    expect(page).toBeDefined();
    expect(page!.slug).toBe('about');
    expect(page!.title.rendered).toBe('About');
  });

  it('getPageBySlug returns undefined for non-existent slug', async () => {
    const page = await client.getPageBySlug('non-existent-page-slug-999');

    expect(page).toBeUndefined();
  });

  it('getAllPages returns all 10 seed pages', async () => {
    const all = await client.getAllPages();

    expect(all).toHaveLength(10);
  });

  it('getPagesPaginated returns pagination metadata', async () => {
    const result = await client.getPagesPaginated({ perPage: 5, page: 1 });

    expect(result.data).toHaveLength(5);
    expect(result.total).toBe(10);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(5);
  });
});
