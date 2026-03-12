import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the Astro build integration test.
 * Uses env-loader for WP_BASE_URL but skips the full global setup
 * (no wp-cli password reset, no app-password creation).
 */
export default defineConfig({
  test: {
    include: ['tests/integration/build/**/*.test.ts'],
    setupFiles: ['./tests/setup/env-loader.ts'],
    passWithNoTests: false,
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: ['verbose'],
  },
});
