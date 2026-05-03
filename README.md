# WordPress Astro.js Integration

Astro-first integration for WordPress with content loaders, server actions, auth bridge helpers, catalog virtual modules, and rendering components.

This package is built against `fluent-wp-client` `^3.0.0` and expects your Astro project to use the same client package directly.
It supports Astro `^6.0.0`.

## Install

```bash
npm install wp-astrojs-integration fluent-wp-client
```

If you use a coding agent, install both the fluent client and Astro integration skills:

```bash
npx skills https://github.com/JUVOJustin/fluent-wp-client
npx skills https://github.com/JUVOJustin/astrojs-wp-integration
```

## Feature overview

| Feature | What you get in Astro | Main API |
|---|---|---|
| Live content collections | Request-time WordPress data for SSR routes | `defineLiveCollection` + `wordPress*Loader` |
| Route caching | Astro `cacheHint` metadata plus a targeted invalidation action for live routes | `Astro.cache.set()`, `createWpCacheInvalidateAction` |
| Catalog integration | Build-time WordPress discovery cached in Astro and reused by catalog-aware helpers | `wp-astrojs-integration/integration`, `virtual:wp-astrojs/catalog` |
| Static content collections | Build-time WordPress snapshots for SSG | `defineCollection` + `wordPress*StaticLoader` |
| Server actions | Typed create/update/delete actions for posts, pages, users, and abilities | `create*Action` factories |
| Auth bridge | Login/session helpers for Astro server actions and middleware | `createWordPressAuthBridge` |
| Discovery + typesafety | Use `fluent-wp-client` discovery, embed helpers, and Zod conversion utilities with Astro catalog helpers | `fluent-wp-client`, `virtual:wp-astrojs/*` |
| Rendering components | Gutenberg-friendly HTML and media rendering in Astro | `WPContent`, `WPImage` |

Use `fluent-wp-client` as the WordPress client and schema source of truth. Use this package for the Astro-specific integration points.

## Available entities

| Entity | Schema from `fluent-wp-client/zod` | Live loader | Static loader | Notes |
|---|---|---|---|---|
| Posts | `postSchema` | `wordPressPostLoader` | `wordPressPostStaticLoader` | |
| Pages | `pageSchema` | `wordPressPageLoader` | `wordPressPageStaticLoader` | |
| Media | `mediaSchema` | `wordPressMediaLoader` | `wordPressMediaStaticLoader` | |
| Categories | `categorySchema` | `wordPressCategoryLoader` | `wordPressCategoryStaticLoader` | |
| Tags | `categorySchema` | `wordPressTagLoader` | `wordPressTagStaticLoader` | |
| Custom taxonomies | `categorySchema` | `wordPressTermLoader` | `wordPressTermStaticLoader` | Pass custom REST `resource` |
| Custom Post Types | `contentWordPressSchema` (extend) | `wordPressContentLoader` | `wordPressContentStaticLoader` | Pass custom REST `resource` |
| Users | `WordPressAuthor` | `wordPressUserLoader` | `wordPressUserStaticLoader` | |

## Quick start

### 1) Configure the catalog integration

Add the Astro integration so WordPress discovery metadata is fetched during builds and reused by catalog-aware clients, schemas, collections, and actions.

```js title="astro.config.mjs"
import { defineConfig } from 'astro/config';
import wordpress from 'wp-astrojs-integration/integration';

export default defineConfig({
  integrations: [
    wordpress({
      catalog: {
        enabled: true,
        refresh: 'build',
        required: true,
      },
    }),
  ],
});
```

Set the WordPress URL in `.env`.

```bash title=".env"
WP_CATALOG_URL=https://cms.example.com
```

### 2) Create a catalog-backed client

Create clients from the generated virtual module so discovery-aware calls automatically use the stored catalog instead of re-discovering WordPress.

```ts title="src/lib/wp.ts"
import { createWordPressClient } from 'virtual:wp-astrojs/catalog';

export const wp = createWordPressClient({
  baseUrl: import.meta.env.WP_CATALOG_URL,
});
```

### 3) Define schema-backed collections

Use `defineWordPressCollection()` to create Astro collections with the correct WordPress loader and a catalog-derived Zod schema. When catalog discovery runs with `WP_CATALOG_URL`, the integration also writes typed Zod artifacts to Astro's cache using `fluent-wp-client schemas --zod-out ... --types-out ...` and uses those schemas automatically for stronger collection inference.

```ts title="src/content.config.ts"
import { defineWordPressCollection } from 'virtual:wp-astrojs/collections';
import { wp } from './lib/wp';

export const collections = {
  posts: defineWordPressCollection('posts', { client: wp }),
  books: defineWordPressCollection('books', { client: wp }),
  livePosts: defineWordPressCollection('posts', {
    mode: 'live',
    client: wp,
  }),
};
```

Generated schemas are also available from `virtual:wp-astrojs/generated-schemas` when you need to reuse the same real-instance validators directly.

```ts title="src/actions/index.ts"
import { wpBookSchema } from 'virtual:wp-astrojs/generated-schemas';

type Book = import('virtual:wp-astrojs/generated-schemas').WPBook;
```

### 4) Use catalog schemas in actions

Use `withWordPressActionSchemas()` to add catalog-derived input and response schemas to action factories. Explicit `schema` and `responseSchema` options still win when you pass them.

```ts title="src/actions/index.ts"
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

### 5) Render WordPress content in Astro pages

```astro
---
import { getLiveEntry } from 'astro:content';
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';

const { slug } = Astro.params;
const { entry: post } = await getLiveEntry('livePosts', { slug });
---

<article>
  <h1 set:html={post.data.title.rendered} />
  <WPContent content={post.data.content.rendered} baseUrl={import.meta.env.WP_CATALOG_URL} />
</article>
```

## Manual Loader Setup

You can still wire loaders and schemas manually when you want full control.

### Live collection (SSR)

```ts
// src/live.config.ts
import { defineLiveCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostLoader } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

If you need request instrumentation, a cache layer, or a proxy, pass a custom `fetch` to `WordPressClient` and then reuse that client with the live loader:

```ts
const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
  fetch: async (input, init) => {
    return fetch(input, init);
  },
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postSchema,
});
```

### Static collection (SSG)

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostStaticLoader } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});

const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

Live loaders return the base resource payload by default. If you need embedded relations like featured media, enable `embed` on the loader options. If you need a custom request pipeline, set `fetch` on `WordPressClient`; the live loaders reuse that client as-is.

Use `mapEntry` when a site needs to normalize fields before Astro receives loader data. For example, build an ACF choice-label lookup from WordPress discovery metadata and plug that lookup into the mapper:

```ts
const acfFields = await wp.content('posts').getSchemaValue<
  Record<string, { choices?: Array<{ value: string; label: string }> }>
>('properties.acf.properties');

const choiceLabels = new Map(
  Object.entries(acfFields ?? {})
    .filter(([, field]) => Array.isArray(field.choices))
    .map(([fieldName, field]) => [
      fieldName,
      new Map(field.choices!.map((choice) => [choice.value, choice.label])),
    ]),
);

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp, {
    mapEntry: (post) => ({
      ...post,
      acf: Object.fromEntries(
        Object.entries(post.acf ?? {}).map(([fieldName, value]) => [
          fieldName,
          choiceLabels.get(fieldName)?.get(String(value)) ?? value,
        ]),
      ),
    }),
  }),
  schema: postSchema,
});
```

`mapEntry` is available on live and static loaders. The callback receives `{ resource, filter }` for live loaders so mappings can vary by resource or request filter. Use `mapResponse` on create/update actions when successful write responses need the same normalization. See `docs/mapping.mdx` for a reusable mapper pattern.

## Route caching

Live loaders return Astro-compatible `cacheHint` values, and `createWpCacheInvalidateAction()` invalidates changed post, term, or user routes. See `docs/caching.mdx` for setup details, examples, and Astro reference links.

## AI SDK tools

AI SDK tools live in `fluent-wp-client/ai-sdk`. This package does not wrap them with live-loader helpers because live loaders are for public/shared content, not per-user request auth.

For public AI reads, use the fluent client tools directly and apply any Astro route cache policy in the endpoint:

```ts
import type { APIRoute } from 'astro';
import { WordPressClient } from 'fluent-wp-client';
import { getContentTool } from 'fluent-wp-client/ai-sdk';

const wp = new WordPressClient({
  baseUrl: import.meta.env.WP_URL,
});

export const GET: APIRoute = async (context) => {
  const tool = getContentTool(wp, {
    contentType: 'posts',
  });

  if (!tool.execute) throw new Error('Content tool is not executable.');

  const result = await tool.execute({ slug: 'hello-world' }, {
    toolCallId: 'read-post',
    messages: [],
  });

  context.cache.set({ maxAge: 300, swr: 60 });

  return Response.json(result);
};
```

For public/shared content, fluent AI tools can also fetch through an Astro live collection so the endpoint benefits from live-loader cache hints:

```ts
import { getLiveEntry } from 'astro:content';
import { getContentTool } from 'fluent-wp-client/ai-sdk';

export const GET: APIRoute = async (context) => {
  const tool = getContentTool(wp, {
    contentType: 'posts',
    fetch: async (input) => {
      if (!input.id && !input.slug) {
        throw new Error('Provide either id or slug to read a post.');
      }

      const lookup = input.id ? { id: input.id } : { slug: input.slug };
      const { entry, error, cacheHint } = await getLiveEntry('posts', lookup);

      if (error) throw error;
      if (cacheHint) context.cache.set(cacheHint);

      return { item: entry?.data };
    },
  });

  if (!tool.execute) throw new Error('Content tool is not executable.');

  const result = await tool.execute({ slug: 'hello-world' }, {
    toolCallId: 'read-post',
    messages: [],
  });

  context.cache.set({ maxAge: 300, swr: 60 });
  return Response.json(result);
};
```

For user-specific AI endpoints, create or read a request-scoped client from middleware/auth bridge state and opt out of route caching:

```ts
context.cache.set(false);
const wp = context.locals.wp;
```

Do not route personalized AI reads through Astro live loaders. Live loaders do not receive `request`, `cookies`, or `locals`.

## Astro actions

```ts
import {
  createCreatePostAction,
  createDeletePostAction,
  createUpdatePostAction,
  createCreateUserAction,
  createDeleteUserAction,
  createUpdateUserAction,
} from 'wp-astrojs-integration';
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: import.meta.env.WP_URL,
  auth: {
    username: import.meta.env.WP_USERNAME,
    password: import.meta.env.WP_APP_PASSWORD,
  },
});

export const server = {
  createPost: createCreatePostAction(wp),
  updatePost: createUpdatePostAction(wp),
  deletePost: createDeletePostAction(wp),
  createUser: createCreateUserAction(wp),
  updateUser: createUpdateUserAction(wp),
  deleteUser: createDeleteUserAction(wp),
};
```

Action factories accept an optional `responseSchema` for resource and ability actions when you want Astro-side response validation with a Standard Schema-compatible validator (for example Zod).

For a schema-generation and discovery-based workflow, see `docs/typesafe-integration.mdx`.

## Auth bridge

The auth bridge is the central client-first request-auth layer for Astro middleware and actions.
Helpers like `resolveUser()` and `isAuthenticated()` only reflect end-user request auth.
`getClient()` and `getClientConfig()` can opt into bridge-level static credentials with `{ allowStaticAuthFallback: true }` when you explicitly want a service-client fallback.

```ts
import { defineMiddleware } from 'astro:middleware';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
  createWordPressAuthBridge,
} from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  cookieName: 'wp_user_session',
});

// Middleware: get the authenticated client for this request.
export const onRequest = defineMiddleware(async (context, next) => {
  const wp = await wordPressAuthBridge.getClient(context);

  if (!wp) {
    return Response.redirect(new URL('/login', context.url), 302);
  }

  const user = await wp.users().me();
  context.locals.user = user;

  return next();
});

// Actions: reuse the same request-scoped client resolver.
export const server = {
  login: wordPressAuthBridge.loginAction,
  createPost: createCreatePostAction(wordPressAuthBridge.getClient),
  updatePost: createUpdatePostAction(wordPressAuthBridge.getClient),
  deletePost: createDeletePostAction(wordPressAuthBridge.getClient),
};
```

You can also create one static client directly when you do not need request-scoped auth:

```ts
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: import.meta.env.WP_URL,
  auth: {
    username: import.meta.env.WP_USERNAME,
    password: import.meta.env.WP_APP_PASSWORD,
  },
});

export const server = {
  createPost: createCreatePostAction(wp),
};
```

## Auth utility exports

Import auth helpers from `fluent-wp-client`, including:

- `createAuthResolver`
- `jwtAuthTokenResponseSchema`
- `jwtAuthErrorResponseSchema`
- `jwtAuthValidationResponseSchema`

Use these when building custom login/session flows so you can share the same runtime validation and context-auth patterns as the built-in bridge.

## Term actions (categories, tags, custom taxonomies)

```ts
import {
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
} from 'wp-astrojs-integration';
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: import.meta.env.WP_URL,
  auth: {
    username: import.meta.env.WP_USERNAME,
    password: import.meta.env.WP_APP_PASSWORD,
  },
});

export const server = {
  createCategory: createCreateTermAction(wp, { resource: 'categories' }),
  updateTag: createUpdateTermAction(wp, { resource: 'tags' }),
  deleteGenre: createDeleteTermAction(wp, { resource: 'genres' }),
};
```

## Extending schemas

```ts
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostLoader } from 'wp-astrojs-integration';
import { z } from 'astro/zod';

const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});

const customPostSchema = postSchema.extend({
  acf: z.object({
    video_url: z.string().optional(),
    featured_color: z.string().optional(),
  }).optional(),
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: customPostSchema,
});
```

## Live vs static loaders

| Feature | Live loaders | Static loaders |
|---|---|---|
| Freshness | Request-time | Build-time |
| Best for | SSR and frequently changing public/shared content | SSG and stable content |
| Astro API | `defineLiveCollection` | `defineCollection` |
| Content APIs | `getLiveEntry`, `getLiveCollection` | `getEntry`, `getCollection` |
| Post/page payload shape | Plain serializable objects | Plain serializable objects |

Live loaders accept fluent-wp-client collection filters through `getLiveCollection()`, including `search`, `include`, `exclude`, taxonomy filters, `slug`, and custom query params. Static loaders accept the same build-time query shape through `options.filter`; the filter is passed to `listAll()` and all matching pages are fetched during the build.

## Development and testing

```bash
npm run wp:start
npm run wp:status
npm test                    # Run all test projects
npm run test:integration    # Integration project (actions/loaders/auth)
npm run test:build          # Static build project
npm run wp:stop
```

`wp-env` uses automatic port selection in this repository. If `8888` is unavailable, run `npm run wp:status` to see the active local WordPress URL and ports.

Other useful commands:

```bash
npm run test:watch
npm run wp:clean
npm run wp:status
npm run build
```

Local integration test environment:

- `.wp-env.json` defines the local WordPress setup.
- `tests/wp-env/` contains mu-plugins and seeded content.
- `tests/setup/global-setup.ts` provisions app password, JWT, cookie+nonce fixtures, and boots a real Astro dev server for the `integration` Vitest project.
- `tests/setup/env-loader.ts` loads `.test-env.json` values for both `integration` and `static-build` projects.
- `tests/fixtures/astro-site/` is the shared Astro fixture used by integration action tests (`astro dev` + `/_actions/*`), live collection runtime tests (`src/live.config.ts` + `getLiveCollection()` / `getLiveEntry()`), and the build integration test (`astro build` with `ASTRO_TEST_MODE=build`).
- Action integration suites call fixture `/_actions/*` endpoints via HTTP; tests do not execute package action helpers directly in Vitest workers.
- `tests/integration/` contains Astro-facing integration tests for loaders (including live runtime and static build coverage), actions, auth bridge behavior, meta, ACF, and abilities.

## Docs

- Reading content: `docs/reading-content.mdx`
- Testing guide: `docs/testing.mdx`
- Auth bridge: `docs/auth-action-bridge.mdx`
- Action overview: `docs/actions/index.mdx`
- Post actions: `docs/actions/posts.mdx`
- Term actions: `docs/actions/terms.mdx`
- User actions: `docs/actions/users.mdx`
- Ability actions: `docs/actions/abilities.mdx`

## License

MIT
