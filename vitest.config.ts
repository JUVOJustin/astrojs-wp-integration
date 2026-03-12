import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const astroActionsRuntimeShim = fileURLToPath(
  new URL('./tests/helpers/astro-actions-runtime.ts', import.meta.url),
);

/**
 * Vitest configuration for root integration coverage against the local wp-env site.
 */
export default defineConfig({
  resolve: {
    alias: {
      'astro:actions': astroActionsRuntimeShim,
    },
  },
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
