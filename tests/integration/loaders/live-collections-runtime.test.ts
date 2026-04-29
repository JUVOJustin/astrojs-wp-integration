import { describe, expect, it } from 'vitest';
import { getAstroDevUrl } from '../../helpers/action-client';

/**
 * Live collection runtime coverage through real Astro SSR routes.
 *
 * These tests verify the shared fixture uses Astro's live collection APIs for
 * the same WordPress resource set covered by the static build fixture.
 */
describe('Live Collections: Astro runtime', () => {
  it('renders live collections for posts, pages, categories, and books', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-collections`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(
        `Expected status 200 but got ${response.status}: ${html}`,
      );
    }

    expect(html).not.toContain('id="live-posts-error"');
    expect(html).not.toContain('id="live-pages-error"');
    expect(html).not.toContain('id="live-categories-error"');
    expect(html).not.toContain('id="live-books-error"');

    const postsCount = html.match(/Live Posts \((\d+)\)/);
    const pagesCount = html.match(/Live Pages \((\d+)\)/);
    const categoriesCount = html.match(/Live Categories \((\d+)\)/);
    const booksCount = html.match(/Live Books \((\d+)\)/);

    expect(postsCount).not.toBeNull();
    expect(pagesCount).not.toBeNull();
    expect(categoriesCount).not.toBeNull();
    expect(booksCount).not.toBeNull();

    expect(parseInt(postsCount![1], 10)).toBe(100);
    expect(parseInt(pagesCount![1], 10)).toBe(10);
    expect(parseInt(categoriesCount![1], 10)).toBeGreaterThanOrEqual(6);
    expect(parseInt(booksCount![1], 10)).toBe(10);

    expect(html).toContain('data-type="post"');
    expect(html).toContain('data-type="page"');
    expect(html).toContain('data-type="category"');
    expect(html).toContain('data-type="book"');
  });

  it('renders book entries with extended CPT schema data', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-collections`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('data-type="book"');
    expect(html).toContain('data-subtitle="Subtitle for test book 001"');
  });

  it('renders live users without exposing private emails', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-users`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(
        `Expected status 200 but got ${response.status}: ${html}`,
      );
    }

    expect(html).not.toContain('id="live-users-error"');

    const usersCount = html.match(/Live Users \((\d+)\)/);
    expect(usersCount).not.toBeNull();
    expect(parseInt(usersCount![1], 10)).toBeGreaterThanOrEqual(1);

    // Emails must not leak because the fixture client is unauthenticated
    expect(html).not.toContain('alice@example.com');
    expect(html).not.toContain('bob@example.com');
    expect(html).toContain('data-type="user"');
  });
});

describe('Live Entry: Astro runtime', () => {
  it('renders seeded post, page, category, and book entries through getLiveEntry', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-entry`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(
        `Expected status 200 but got ${response.status}: ${html}`,
      );
    }

    expect(html).not.toContain('id="live-entry-post-error"');
    expect(html).not.toContain('id="live-entry-page-error"');
    expect(html).not.toContain('id="live-entry-category-error"');
    expect(html).not.toContain('id="live-entry-book-error"');

    expect(html).toContain('id="live-entry-post"');
    expect(html).toContain('id="live-entry-page"');
    expect(html).toContain('id="live-entry-category"');
    expect(html).toContain('id="live-entry-book"');

    expect((html.match(/data-found="true"/g) ?? []).length).toBe(4);
    expect(html).toContain('Slug: test-post-001');
    expect(html).toContain('Slug: about');
    expect(html).toContain('Slug: technology');
    expect(html).toContain('Slug: test-book-001');
    expect(html).toContain('Subtitle: Subtitle for test book 001');
  });
});
