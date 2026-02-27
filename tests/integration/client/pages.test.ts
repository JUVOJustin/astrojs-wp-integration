import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressClient } from '../../../src/client';
import { createPublicClient } from '../../helpers/wp-client';

describe('Client: Pages', () => {
  let client: WordPressClient;
  let seededPageIds: number[];

  beforeAll(() => {
    client = createPublicClient();
    seededPageIds = (process.env.WP_SEEDED_PAGE_IDS || '').split(',').map(Number);
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

  it('getPage fetches a single page by ID', async () => {
    const page = await client.getPage(seededPageIds[0]);

    expect(page.id).toBe(seededPageIds[0]);
    expect(page.title.rendered).toContain('Test Page');
  });

  it('getPageBySlug fetches a page by slug', async () => {
    const pages = await client.getPages();
    const slug = pages[0].slug;

    const page = await client.getPageBySlug(slug);

    expect(page).toBeDefined();
    expect(page!.slug).toBe(slug);
  });

  it('getPageBySlug returns undefined for non-existent slug', async () => {
    const page = await client.getPageBySlug('non-existent-page-slug-999');

    expect(page).toBeUndefined();
  });

  it('getAllPages returns every published page', async () => {
    const all = await client.getAllPages();

    expect(all.length).toBeGreaterThanOrEqual(seededPageIds.length);
    for (const id of seededPageIds) {
      expect(all.some((p) => p.id === id)).toBe(true);
    }
  });

  it('getPagesPaginated returns pagination metadata', async () => {
    const result = await client.getPagesPaginated({ perPage: 1, page: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(1);
  });
});
