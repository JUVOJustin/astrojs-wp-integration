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

import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'astro';
import { describe, expect, it } from 'vitest';
import { resolveWpBaseUrl } from '../../helpers/wp-env';

const execFileAsync = promisify(execFile);

const fixtureRoot = fileURLToPath(
  new URL('../../fixtures/astro-site', import.meta.url),
);
const astroBin = fileURLToPath(
  new URL('../../../node_modules/astro/bin/astro.mjs', import.meta.url),
);

describe('Static Loaders: Astro build integration', () => {
  it('syncs when live config imports catalog-backed collection helpers', async () => {
    const buildRoot = await mkdtemp(
      path.join(path.dirname(fixtureRoot), '.tmp-sync-fixture-'),
    );

    try {
      await cp(fixtureRoot, buildRoot, { recursive: true });

      await execFileAsync(process.execPath, [astroBin, 'sync'], {
        cwd: buildRoot,
        env: {
          ...process.env,
          ASTRO_TEST_CATALOG: '1',
          ASTRO_TEST_LIVE_CATALOG: '1',
          WP_BASE_URL: resolveWpBaseUrl(),
          WP_CATALOG_URL: resolveWpBaseUrl(),
        },
      });
    } finally {
      await rm(buildRoot, { recursive: true, force: true });
    }
  });

  it('builds a minimal site with WordPress static loaders and catalog helpers', async () => {
    const buildRoot = await mkdtemp(
      path.join(path.dirname(fixtureRoot), '.tmp-build-fixture-'),
    );
    try {
      // Copy the shared fixture and strip action routes for static build validation.
      await cp(fixtureRoot, buildRoot, { recursive: true });
      await rm(path.join(buildRoot, 'src', 'actions'), {
        recursive: true,
        force: true,
      });

      // Run the programmatic Astro build against the shared fixture project.
      const previousCatalogFlag = process.env.ASTRO_TEST_CATALOG;
      const previousCatalogUrl = process.env.WP_CATALOG_URL;
      process.env.ASTRO_TEST_MODE = 'build';
      process.env.ASTRO_TEST_CATALOG = '1';
      process.env.WP_CATALOG_URL = resolveWpBaseUrl();
      try {
        await build({ root: buildRoot, logLevel: 'silent' });
      } finally {
        delete process.env.ASTRO_TEST_MODE;

        if (previousCatalogFlag === undefined) {
          delete process.env.ASTRO_TEST_CATALOG;
        } else {
          process.env.ASTRO_TEST_CATALOG = previousCatalogFlag;
        }

        if (previousCatalogUrl === undefined) {
          delete process.env.WP_CATALOG_URL;
        } else {
          process.env.WP_CATALOG_URL = previousCatalogUrl;
        }
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

      const catalogHtml = await readFile(
        path.join(buildRoot, 'dist', 'catalog', 'index.html'),
        'utf-8',
      );

      expect(catalogHtml).toContain('<h1>Catalog Test</h1>');
      expect(catalogHtml).toContain('<p id="has-catalog">true</p>');
      expect(catalogHtml).toMatch(
        /<p id="catalog-path">.*node_modules\/\.astro\/wp-astrojs-test\/catalog\.json<\/p>/,
      );
      expect(catalogHtml).toContain('<p id="has-posts">true</p>');
      expect(catalogHtml).toContain('<p id="has-books">true</p>');
      expect(catalogHtml).toContain('<p id="posts-resource">posts</p>');
      expect(catalogHtml).toContain('<p id="books-resource">books</p>');
      expect(catalogHtml).toContain('<p id="has-posts-item-schema">true</p>');
      expect(catalogHtml).toContain('<p id="has-posts-create-schema">true</p>');
      expect(catalogHtml).toContain(
        '<p id="has-posts-response-schema">true</p>',
      );
      expect(catalogHtml).toMatch(/<p id="catalog-posts-count">\d+<\/p>/);

      const catalogJson = await readFile(
        path.join(
          buildRoot,
          'node_modules',
          '.astro',
          'wp-astrojs-test',
          'catalog.json',
        ),
        'utf-8',
      );
      const catalog = JSON.parse(catalogJson) as {
        content?: Record<string, unknown>;
      };

      expect(catalog.content?.posts).toBeDefined();
      expect(catalog.content?.books).toBeDefined();
    } finally {
      await rm(buildRoot, { recursive: true, force: true });
    }
  });
});
