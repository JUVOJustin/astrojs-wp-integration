/**
 * Shared Astro config for integration fixtures.
 *
 * - Action suites run against `astro dev` and need `output: 'server'`.
 * - Build suites run `astro build` and need `output: 'static'` without an adapter.
 * - Route-caching suites run a production preview with the in-memory cache provider.
 */
import { defineConfig, memoryCache } from 'astro/config';
import node from '@astrojs/node';

const isStaticBuild = process.env.ASTRO_TEST_MODE === 'build';
const isRouteCacheTest = process.env.ASTRO_TEST_ROUTE_CACHE === '1';

export default defineConfig({
  output: isStaticBuild ? 'static' : 'server',
  adapter: !isStaticBuild && isRouteCacheTest ? node({ mode: 'standalone' }) : undefined,
  experimental: isRouteCacheTest ? {
    cache: {
      provider: memoryCache({ max: 100 }),
    },
  } : undefined,
});
