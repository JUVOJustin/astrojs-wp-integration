/**
 * Astro config for the action integration test fixture.
 *
 * Uses on-demand rendering so the dev server can handle action RPC requests.
 * No adapter is needed for dev mode.
 */
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
});
