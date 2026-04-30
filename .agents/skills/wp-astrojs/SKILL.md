---
name: wp-astrojs
description: Use WordPress as a headless backend for Astro projects through `wp-astrojs-integration`. Use this skill when an Astro project consumes WordPress content, defines content collections backed by WordPress, performs CRUD against the WordPress REST API, integrates WordPress auth, or works with the discovery catalog. Trigger when the user mentions WordPress, ACF, headless WP, live or static collections backed by WordPress, or `fluent-wp-client`.
---

## WordPress + Astro Integration

This skill applies when an Astro project uses [`wp-astrojs-integration`](https://github.com/JUVOJustin/astrojs-wp-integration) (built on `fluent-wp-client`).

The library code is small and easy to grep when you need precise API details. Prefer reading from `node_modules/wp-astrojs-integration/dist` over guessing types.

## Quickstart

### 1. Init a `WordPressClient`

For projects that want build-time WordPress discovery, prefer the Astro catalog integration and virtual module:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import wordpress from 'wp-astrojs-integration/integration';

export default defineConfig({
  integrations: [wordpress({ catalog: { enabled: true, refresh: 'build', required: true } })],
});
```

```ts
// src/lib/wp.ts
import { createWordPressClient } from 'virtual:wp-astrojs/catalog';

export const wp = createWordPressClient({
  baseUrl: import.meta.env.WP_CATALOG_URL,
});
```

Set `WP_CATALOG_URL` and optionally `WP_CATALOG_USERNAME` / `WP_CATALOG_PASSWORD`, `WP_CATALOG_TOKEN`, or `WP_CATALOG_AUTH_HEADER` in `.env`. See `docs/catalog.mdx` for the full setup.

Use `required: false` when local dev should continue without a reachable WordPress backend. The virtual module remains importable, but `hasCatalog` is `false`.

Catalog-derived schemas can simplify collections and actions:

```ts
// src/content.config.ts
import { defineWordPressCollection } from 'virtual:wp-astrojs/collections';
import { wp } from './lib/wp';

export const collections = {
  posts: defineWordPressCollection('posts', { client: wp }),
  books: defineWordPressCollection('books', { client: wp }),
};
```

```ts
// src/actions/index.ts
import { createCreatePostAction } from 'wp-astrojs-integration';
import { withWordPressActionSchemas } from 'virtual:wp-astrojs/schemas';
import { wp } from '../lib/wp';

export const server = {
  createBook: createCreatePostAction(
    wp,
    withWordPressActionSchemas('books', { resource: 'books' }),
  ),
};
```

For simple projects without catalog discovery, instantiate the client directly:

```ts
// src/lib/wp.ts
import { WordPressClient } from 'wp-astrojs-integration';

export const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});
```

For authenticated requests, pass `auth` (basic, JWT, app password) or `authHeaders` / `authResolver` for request-scoped auth. Use `createWordPressAuthBridge()` for cookie/session-based flows in middleware and actions.

### 2. Define a live collection (SSR / runtime)

Live collections fetch from WordPress per request. See the Astro [Content Loader reference](https://docs.astro.build/en/reference/content-loader-reference) for the underlying API.

```ts
// src/live.config.ts
import { defineLiveCollection } from 'astro:content';
import {
  postSchema,
  wordPressPostLoader,
} from 'wp-astrojs-integration';
import { wp } from './lib/wp';

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

Use in a page:

```astro
---
import { getLiveEntry } from 'astro:content';
const { entry, cacheHint } = await getLiveEntry('posts', { slug: Astro.params.slug });
if (cacheHint) Astro.cache.set(cacheHint);
---
```

### 3. Define a build-time (static) collection

Static collections fetch at build time and store entries in the Astro content store.

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import {
  postSchema,
  wordPressPostStaticLoader,
} from 'wp-astrojs-integration';
import { wp } from './lib/wp';

const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

Loader factories exist for `post`, `page`, `media`, `category`, `tag`, `term` (custom taxonomies), `user`, and generic `content` (custom post types). Static variants follow the `*StaticLoader` naming.

## CRUD Operations

CRUD goes through Astro server actions. Register action factories in `src/actions/index.ts` and the package handles input validation, auth, and error mapping to `ActionError`.

```ts
// src/actions/index.ts
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
} from 'wp-astrojs-integration';
import { wp } from '../lib/wp';

export const server = {
  createPost: createCreatePostAction(wp),
  updatePost: createUpdatePostAction(wp),
  deletePost: createDeletePostAction(wp),
};
```

Equivalent factories exist for `term`, `user`, and ability actions. Each factory accepts:

- `resource` for custom post types or taxonomies (e.g. `'books'`, `'genres'`).
- `schema` to extend the Zod input schema for ACF or plugin fields.
- `responseSchema` to validate the WordPress response.
- `mapResponse` to normalize successful responses (mirrors loader `mapEntry`).

Calling actions:

```ts
const { data, error } = await Astro.callAction(actions.createPost, {
  title: 'Hello',
  status: 'publish',
});
```

`error` is an `ActionError` with HTTP-mapped codes (`UNAUTHORIZED`, `NOT_FOUND`, etc.).

## Catalog and Discovery

The client can introspect WordPress once and reuse the result everywhere through the `WordPressDiscoveryCatalog`.

In Astro projects, the simplified path is `wp-astrojs-integration/integration` plus `virtual:wp-astrojs/catalog`. This fetches and stores the catalog in Astro's cache directory during setup/build, then seeds clients with `client.useCatalog(catalog)` automatically.

```ts
// One-time exploration
const catalog = await wp.explore();
await persistCatalog(JSON.stringify(catalog));

// Later: avoid network discovery
const stored = JSON.parse(await loadCatalog());
if (stored) wp.useCatalog(stored);

// Read schema metadata without another request
const acfFields = await wp
  .content('posts')
  .getSchemaValue('properties.acf.properties');
```

Useful methods on `WordPressClient`:

- `wp.explore()` — discover all resources/abilities.
- `wp.useCatalog(catalog)` — seed a stored catalog.
- `wp.getCachedCatalog()` — read the in-memory catalog snapshot.
- `wp.content(resource).describe()` / `.getSchemaValue(path)` — typed schema lookups.

Use the catalog to drive site-specific normalization (for example ACF choice → label maps) inside loader `mapEntry` and action `mapResponse` callbacks. The same callback can be shared across loaders and actions.

## Conventions

- Treat `WordPressClient` from `fluent-wp-client` as the integration core; build loaders/actions on top of it.
- Use `mapEntry` (loaders) and `mapResponse` (actions) for site-specific value normalization. Keep mapping rules in app code, not in the library.
- Loader payloads must remain plain serializable objects — no helper methods on `entry.data`.
- Use Standard Schema-compatible validators (Zod or otherwise) for response schemas.
- Prefer reading the package source under `node_modules/wp-astrojs-integration/dist` instead of guessing API shapes.

## References

- Astro Content Loader reference: https://docs.astro.build/en/reference/content-loader-reference
- Reading content: [references/reading-content.mdx](references/reading-content.mdx)
- Mapping values across loaders/actions: [references/mapping.mdx](references/mapping.mdx)
- Caching and route invalidation: [references/caching.mdx](references/caching.mdx)
- Auth bridge for sessions/middleware: [references/auth-action-bridge.mdx](references/auth-action-bridge.mdx)
- AI SDK live-collection tools: [references/ai-sdk.mdx](references/ai-sdk.mdx)
- Catalog integration: [references/catalog.mdx](references/catalog.mdx) and `docs/catalog.mdx`
- Typesafe schema generation: [references/typesafe-integration.mdx](references/typesafe-integration.mdx)
- Actions overview (incl. abilities): [references/actions.mdx](references/actions.mdx)
