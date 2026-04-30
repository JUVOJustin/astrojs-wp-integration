/**
 * Shared Astro config for integration fixtures.
 *
 * - Action suites run against `astro dev` and need `output: 'server'`.
 * - Build suites run `astro build` and need `output: 'static'` without an adapter.
 * - Route-caching suites run a production preview with the in-memory cache provider.
 */

import node from '@astrojs/node';
import { defineConfig, memoryCache } from 'astro/config';
import wordpress from '../../../src/integration';

const isStaticBuild = process.env.ASTRO_TEST_MODE === 'build';
const isRouteCacheTest = process.env.ASTRO_TEST_ROUTE_CACHE === '1';
const isCatalogTest = process.env.ASTRO_TEST_CATALOG === '1';

export default defineConfig({
  output: isStaticBuild ? 'static' : 'server',
  adapter:
    !isStaticBuild && isRouteCacheTest
      ? node({ mode: 'standalone' })
      : undefined,
  experimental: isRouteCacheTest
    ? {
        cache: {
          provider: memoryCache({ max: 100 }),
        },
      }
    : undefined,
  integrations: [
    wordpress({
      catalog: isCatalogTest
        ? {
            enabled: true,
            refresh: 'always',
            url: process.env.WP_CATALOG_URL,
            cacheFile: 'wp-astrojs-test/catalog.json',
          }
        : false,
    }),
  ],
});
