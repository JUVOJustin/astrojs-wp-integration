/**
 * Astro build integration test.
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
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fixtureRoot = fileURLToPath(new URL('./fixtures/minimal-site', import.meta.url));

describe('Astro build integration', () => {
  it('builds a minimal site with WordPress static loaders', async () => {
    // Run the programmatic Astro build against the fixture project.
    await build({ root: fixtureRoot, logLevel: 'silent' });

    // Read the built index.html produced by the build.
    const outputPath = path.join(fixtureRoot, 'dist', 'index.html');
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
  });
});
