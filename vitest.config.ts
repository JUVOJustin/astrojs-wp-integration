import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration with dedicated projects for integration and build coverage.
 */
export default defineConfig({
  test: {
    passWithNoTests: false,
    reporters: ['verbose'],
    projects: [
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['tests/integration/loaders/static-loader-build.test.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          setupFiles: ['./tests/setup/env-loader.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'static-build',
          include: ['tests/integration/loaders/static-loader-build.test.ts'],
          setupFiles: ['./tests/setup/env-loader.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
