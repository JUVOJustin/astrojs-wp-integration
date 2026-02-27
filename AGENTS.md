# Agent Instructions

## Project Overview

`wp-astrojs-integration` is an npm package that provides WordPress integration for Astro.js. It includes:

- **WordPressClient** (`src/client/`) — typed HTTP client for the WP REST API
- **Static loaders** (`src/loaders/static.ts`) — build-time data fetchers for `defineCollection`
- **Live loaders** (`src/loaders/live.ts`) — runtime data fetchers for `defineLiveCollection`
- **Zod schemas** (`src/schemas/`) — validation schemas for all WP entities
- **Astro components** (`src/components/`) — `WPContent.astro`, `WPImage.astro`

## Testing

### Philosophy

- **Integration tests only** — no unit tests. Every test runs against a real WordPress instance.
- Tests exercise the full stack: TypeScript code -> HTTP -> WordPress REST API -> response validation.
- This catches real-world issues (serialization, pagination caps, auth flows) that mocks would miss.

### Test infrastructure

| Component | Purpose |
|---|---|
| `@wordpress/env` | Spawns a local WordPress Docker container |
| `Vitest` | Test runner (config in `vitest.config.ts`) |
| `.wp-env.json` | wp-env config — PHP version, mu-plugin mappings, lifecycle scripts |
| `tests/wp-env/mu-plugins/` | Must-use plugins mounted into the WP container |
| `tests/setup/global-setup.ts` | Vitest globalSetup — waits for WP API, creates app password, seeds content |
| `tests/setup/env-loader.ts` | Vitest setupFile — reads `.test-env.json` into `process.env` for workers |
| `tests/helpers/` | Shared test utilities (mock store, mock logger, WP client factories) |

### Running tests

```bash
npm run wp:start   # Start WordPress Docker container (required once)
npm test           # Run all integration tests
npm run test:watch # Run in watch mode
npm run wp:stop    # Stop the container
npm run wp:clean   # Destroy container and volumes
```

### How to write new tests

1. **Always write integration tests**, not unit tests. Test against the real WP REST API.
2. Place tests in `tests/integration/client/` for `WordPressClient` methods, or `tests/integration/loaders/` for loader functions.
3. Use the helpers in `tests/helpers/`:
   - `createPublicClient()` / `createAuthClient()` from `wp-client.ts` for API access
   - `createMockStore()` from `mock-store.ts` for static loader tests
   - `createMockLogger()` from `mock-logger.ts` for static loader tests
4. One test file per resource type (posts, pages, categories, tags, media, users, settings).
5. Test both success paths and error paths (e.g., non-existent slug returns `undefined`, unauthenticated request throws).
6. Static loaders need a mock `store` (with `clear` and `set` methods) and a mock `logger` (with `info`, `error`, `warn`). They write to the store; assert on the store contents.
7. Live loaders return plain objects from `loadCollection()` / `loadEntry()`. Assert on the returned data directly.

### What to test when adding new features

- **New client method**: Add tests to the appropriate file in `tests/integration/client/`. Cover: returns data, required fields present, pagination, slug lookup, error cases.
- **New static loader**: Add tests to `tests/integration/loaders/static-loaders.test.ts`. Cover: populates store, correct keys, rendered HTML presence (for content types).
- **New live loader**: Add tests to `tests/integration/loaders/live-loaders.test.ts`. Cover: `loadCollection` returns entries, `loadEntry` by slug, `loadEntry` by id, error for non-existent entry.
- **New WP entity/resource**: Create a new test file in `tests/integration/client/`, seed the content in `tests/setup/global-setup.ts`, and add cleanup in the teardown function.

### wp-env lifecycle

The `.wp-env.json` file configures:
- **`mappings`**: Mounts `tests/wp-env/mu-plugins/` into the container's `wp-content/mu-plugins/`. Add new mu-plugins here if the test environment needs WordPress-side configuration.
- **`lifecycleScripts.afterStart`**: Runs after `wp-env start` — currently configures permalink structure. This is the right place for one-time WordPress configuration that must survive container restarts.

### Key gotchas

- `wp-env` output includes status lines (ℹ/✔). The `wpCli()` helper in `global-setup.ts` strips these. Always use it instead of raw `execSync`.
- Vitest `globalSetup` runs in a separate process — `process.env` changes do NOT propagate to test workers. Env vars are bridged via `.test-env.json` (written by globalSetup, read by `env-loader.ts` setupFile).
- WordPress application passwords require HTTPS by default. The mu-plugin at `tests/wp-env/mu-plugins/enable-app-passwords.php` overrides this for HTTP localhost.
- The WP REST API caps `per_page` at 100. Use `getAll*()` methods for full pagination instead of setting high `perPage` values.

## Code Style

Follow the rules in the global `AGENTS.md` (clean code, exit early, DRY, English comments). Additionally:

- Schemas live in `src/schemas/` — one file per concern.
- Client methods live in individual files under `src/client/` (e.g., `posts.ts`, `pages.ts`).
- Loaders are split into `src/loaders/static.ts` and `src/loaders/live.ts`.
- All public API is re-exported from `src/index.ts`.

## npm Package

The `files` field in `package.json` is an allowlist: only `dist/` and `src/components/` are published. Test files, wp-env config, and vitest config are excluded automatically. When adding new directories, verify they are not unintentionally included by running `npm pack --dry-run`.
