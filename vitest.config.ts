import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration with dedicated projects for integration and build coverage.
 */
export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      {
        test: {
          environment: 'node',
          exclude: ['tests/integration/loaders/static-loader-build.test.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          hookTimeout: 60_000,
          include: ['tests/integration/**/*.test.ts'],
          name: 'integration',
          setupFiles: ['./tests/setup/env-loader.ts'],
          testTimeout: 60_000,
        },
      },
      {
        test: {
          environment: 'node',
          hookTimeout: 120_000,
          include: ['tests/integration/loaders/static-loader-build.test.ts'],
          name: 'static-build',
          setupFiles: ['./tests/setup/env-loader.ts'],
          testTimeout: 120_000,
        },
      },
    ],
    reporters: ['verbose'],
  },
});
