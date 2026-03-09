import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for root integration coverage against the local wp-env site.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/env-loader.ts'],
    passWithNoTests: false,
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
});
