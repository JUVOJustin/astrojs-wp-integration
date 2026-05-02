---
name: wp-astrojs
description: Use WordPress as a headless backend for Astro projects through `wp-astrojs-integration`. Use this skill when an Astro project consumes WordPress content, defines content collections backed by WordPress, performs CRUD against the WordPress REST API, integrates WordPress auth, or works with the discovery catalog. Trigger when the user mentions WordPress, ACF, headless WP, live or static collections backed by WordPress, or `fluent-wp-client`.
---

## WordPress + Astro Integration

This skill applies when an Astro project uses [`wp-astrojs-integration`](https://github.com/JUVOJustin/astrojs-wp-integration) (built on `fluent-wp-client`).

The library code is small and easy to grep when you need precise API details. Prefer reading from `node_modules/wp-astrojs-integration/dist` over guessing types.

## Quickstart

### 1. Init a `WordPressClient`

For projects that want build-time WordPress discovery, use the Astro catalog integration and keep detailed catalog setup in `references/catalog.mdx`:

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

Set `WP_CATALOG_URL` and optional catalog auth env vars in `.env`. Use the virtual modules for catalog-backed clients, generated schemas, and collection/action helpers when the project benefits from discovered resource metadata.

For simple projects without catalog discovery, instantiate the client directly:

```ts
// src/lib/wp.ts
import { WordPressClient } from 'fluent-wp-client';

export const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});
```

For authenticated requests, pass `auth` (basic, JWT, app password) or `authHeaders` / `authResolver` for request-scoped auth. Use `createWordPressAuthBridge()` for cookie/session-based flows in middleware and actions.

### 2. Define a live collection (SSR / runtime)

Live collections fetch from WordPress per request. Read `references/reading-content.mdx` for fuller live/static collection guidance.

```ts
// src/live.config.ts
import { defineLiveCollection } from 'astro:content';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostLoader } from 'wp-astrojs-integration';
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
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostStaticLoader } from 'wp-astrojs-integration';
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

Actions are per-user only when they receive a request-aware client resolver, such as `wordPressAuthBridge.getClient`. Passing a static admin/app-password client makes the action run as that service user for every caller.

```ts
// src/actions/index.ts
import { createUpdatePostAction } from 'wp-astrojs-integration';
import { wordPressAuthBridge } from '../lib/auth/bridge';

export const server = {
  updatePost: createUpdatePostAction(wordPressAuthBridge.getClient),
};
```

Catalog-derived `schema` and `responseSchema` values are validation metadata. They do not grant capabilities or change which WordPress user executes the action. It is safe to generate a catalog with admin credentials and use those schemas with request-scoped actions, as long as the action client itself is request-scoped and catalog metadata is not exposed to browser bundles.

## Per-User Data Reads

Use `fluent-wp-client` directly for account pages, dashboards, drafts, `/users/me`, or any read whose result depends on the current visitor. Live and static loaders do not receive Astro `request`, `cookies`, or `locals`, so they should stay public/shared or statically authenticated.

```astro
---
Astro.cache.set(false);

const wp = await wordPressAuthBridge.getClient(Astro);
if (!wp) return Astro.redirect('/login');

const user = await wp.users().me();
const drafts = await wp.content('posts').list({ status: 'draft' });
---
```

## Catalog and Discovery

The catalog is for WordPress resource/schema metadata, generated collection schemas, and schema-aware action options. Prefer `wp-astrojs-integration/integration` plus `virtual:wp-astrojs/*` in Astro projects, and use `references/catalog.mdx` as the source of truth for setup details.

Keep catalog usage server-only. Catalogs may be generated with admin credentials to discover private resources or fields, but runtime reads and writes still need the correct public, static-service, or request-scoped `WordPressClient` for the operation.

## Conventions

- Treat `WordPressClient` from `fluent-wp-client` as the integration core; build loaders/actions on top of it.
- Use request-scoped `fluent-wp-client` instances for per-user data; do not route visitor-specific reads through live loaders.
- Use `mapEntry` (loaders) and `mapResponse` (actions) for site-specific value normalization. Keep mapping rules in app code, not in the library.
- Loader payloads must remain plain serializable objects — no helper methods on `entry.data`.
- Use `fluent-wp-client/ai-sdk` directly for AI tools; do not route personalized AI reads through live loaders.
- Use Standard Schema-compatible validators (Zod or otherwise) for response schemas.
- Prefer reading the package source under `node_modules/wp-astrojs-integration/dist` instead of guessing API shapes.

## References

- Reading content: [references/reading-content.mdx](references/reading-content.mdx)
- Mapping values across loaders/actions: [references/mapping.mdx](references/mapping.mdx)
- Caching and route invalidation: [references/caching.mdx](references/caching.mdx)
- Auth bridge for sessions/middleware: [references/auth-action-bridge.mdx](references/auth-action-bridge.mdx)
- Catalog integration: [references/catalog.mdx](references/catalog.mdx)
- Typesafe schema generation: [references/typesafe-integration.mdx](references/typesafe-integration.mdx)
- Actions overview (incl. abilities): [references/actions.mdx](references/actions.mdx)
