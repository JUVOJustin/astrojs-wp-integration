/**
 * Static loader Astro build integration test.
 *
 * Runs a real `astro build` against a minimal fixture project that uses the
 * package's static loaders and content collections. This ensures the full
 * Astro pipeline (content config resolution, loader execution, page rendering)
 * works end-to-end against the live WordPress test instance.
 *
 * Requires `wp-env` to be running (`npm run wp:start`).
 */
import { describe, it, expect } from 'vitest';
import { build } from 'astro';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/astro-site', import.meta.url));

describe('Static Loaders: Astro build integration', () => {
  it('builds a minimal site with WordPress static loaders', async () => {
    const buildRoot = await mkdtemp(path.join(path.dirname(fixtureRoot), '.tmp-build-fixture-'));
    try {
      // Copy the shared fixture and strip action routes for static build validation.
      await cp(fixtureRoot, buildRoot, { recursive: true });
      await rm(path.join(buildRoot, 'src', 'actions'), { recursive: true, force: true });

      // Run the programmatic Astro build against the shared fixture project.
      process.env.ASTRO_TEST_MODE = 'build';
      try {
        await build({ root: buildRoot, logLevel: 'silent' });
      } finally {
        delete process.env.ASTRO_TEST_MODE;
      }

      // Read the built index.html produced by the build.
      const outputPath = path.join(buildRoot, 'dist', 'index.html');
      const html = await readFile(outputPath, 'utf-8');

      // The page should render without errors.
      expect(html).toContain('<h1>Build Test</h1>');

      // Posts section should contain seeded content (150 posts).
      expect(html).toContain('<section id="posts">');
      expect(html).toMatch(/Posts \(\d+\)/);

      // Verify at least some posts were loaded.
      const postsCountMatch = html.match(/Posts \((\d+)\)/);
      expect(postsCountMatch).not.toBeNull();
      const postsCount = parseInt(postsCountMatch![1], 10);
      expect(postsCount).toBeGreaterThan(0);

      // Pages section should contain seeded content (10 pages).
      expect(html).toContain('<section id="pages">');
      const pagesCountMatch = html.match(/Pages \((\d+)\)/);
      expect(pagesCountMatch).not.toBeNull();
      const pagesCount = parseInt(pagesCountMatch![1], 10);
      expect(pagesCount).toBeGreaterThan(0);

      // Categories section should contain seeded content (6 categories).
      expect(html).toContain('<section id="categories">');
      const categoriesCountMatch = html.match(/Categories \((\d+)\)/);
      expect(categoriesCountMatch).not.toBeNull();
      const categoriesCount = parseInt(categoriesCountMatch![1], 10);
      expect(categoriesCount).toBeGreaterThan(0);

      // Books section should contain seeded content (10 books).
      expect(html).toContain('<section id="books">');
      const booksCountMatch = html.match(/Books \((\d+)\)/);
      expect(booksCountMatch).not.toBeNull();
      const booksCount = parseInt(booksCountMatch![1], 10);
      expect(booksCount).toBeGreaterThan(0);

      // Mapped posts page should have been generated and contain the ACF
      // choice label (not the raw value). The mu-plugin
      // `register-acf-fields.php` registers `acf_project_status` with
      // choices; the seeded post `test-post-001` has value "in_progress",
      // which the mapper should translate to "In progress".
      const mappedPostsHtml = await readFile(
        path.join(buildRoot, 'dist', 'mapped-posts', 'index.html'),
        'utf-8',
      );

      expect(mappedPostsHtml).toContain('Static Mapped Posts Build Test');
      expect(mappedPostsHtml).toContain('data-slug="test-post-001"');
      expect(mappedPostsHtml).toContain('Project status: In progress');
      expect(mappedPostsHtml).not.toContain('Project status: in_progress');
    } finally {
      await rm(buildRoot, { recursive: true, force: true });
    }
  });
});
