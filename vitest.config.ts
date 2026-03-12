import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const astroActionsRuntimeShim = fileURLToPath(
  new URL('./tests/helpers/astro-actions-runtime.ts', import.meta.url),
);

const resolveAlias = {
  alias: {
    'astro:actions': astroActionsRuntimeShim,
  },
};

/**
 * Vitest configuration with dedicated projects for integration and build coverage.
 */
export default defineConfig({
  test: {
    passWithNoTests: false,
    reporters: ['verbose'],
    projects: [
      {
        resolve: resolveAlias,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['tests/integration/build/**/*.test.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          setupFiles: ['./tests/setup/env-loader.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve: resolveAlias,
        test: {
          name: 'astro-build',
          include: ['tests/integration/build/**/*.test.ts'],
          setupFiles: ['./tests/setup/env-loader.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
