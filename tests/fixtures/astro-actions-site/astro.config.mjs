/**
 * Shared Astro config for integration fixtures.
 *
 * - Action suites run against `astro dev` and need `output: 'server'`.
 * - Build suites run `astro build` and need `output: 'static'` without an adapter.
 */
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: process.env.ASTRO_TEST_MODE === 'build' ? 'static' : 'server',
});
