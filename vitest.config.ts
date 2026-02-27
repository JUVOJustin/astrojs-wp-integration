import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration tests against a live wp-env WordPress instance
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/env-loader.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
});
