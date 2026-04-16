# WordPress Astro.js Integration

Astro-first integration for WordPress with content loaders, server actions, auth bridge helpers, and rendering components.

This package is built against `fluent-wp-client` `^3.0.0`.
It supports Astro `^6.0.0`.

## Install

```bash
npm install wp-astrojs-integration
```

## Feature overview

| Feature | What you get in Astro | Main API |
|---|---|---|
| Live content collections | Request-time WordPress data for SSR routes | `defineLiveCollection` + `wordPress*Loader` |
| Static content collections | Build-time WordPress snapshots for SSG | `defineCollection` + `wordPress*StaticLoader` |
| Server actions | Typed create/update/delete actions for posts, pages, users, and abilities | `create*Action` factories |
| Auth bridge | Login/session helpers for Astro server actions and middleware | `createWordPressAuthBridge` |
| Discovery + typesafety | Re-exported discovery types, embed helpers, and Zod conversion utilities from `fluent-wp-client` v3 | `zodFromJsonSchema`, `zodSchemasFromDescription`, `getEmbedded*` |
| Rendering components | Gutenberg-friendly HTML and media rendering in Astro | `WPContent`, `WPImage` |

## Available entities

| Entity | Schema | Live loader | Static loader | Notes |
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

### 1) Live collection (SSR)

```ts
// src/live.config.ts
import { defineLiveCollection } from 'astro:content';
import { WordPressClient, postSchema, wordPressPostLoader } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

### 2) Static collection (SSG)

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { WordPressClient, postSchema, wordPressPostStaticLoader } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
});

const posts = defineCollection({
  loader: wordPressPostStaticLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

### 3) Render WordPress content in Astro pages

```astro
---
import { getLiveEntry } from 'astro:content';
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';

const { slug } = Astro.params;
const { entry: post } = await getLiveEntry('posts', { slug });
---

<article>
  <h1 set:html={post.data.title.rendered} />
  <WPContent content={post.data.content.rendered} baseUrl={import.meta.env.PUBLIC_WORDPRESS_BASE_URL} />
</article>
```

Live loaders return the base resource payload by default. If you need embedded relations like featured media, fetch that entry with `WordPressClient` and `embed: true`.

## Astro actions

```ts
import {
  WordPressClient,
  createCreatePostAction,
  createDeletePostAction,
  createUpdatePostAction,
  createCreateUserAction,
  createDeleteUserAction,
  createUpdateUserAction,
} from 'wp-astrojs-integration';

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
import { WordPressClient } from 'wp-astrojs-integration';

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

The package re-exports auth helpers from `fluent-wp-client`, including:

- `createAuthResolver`
- `jwtAuthTokenResponseSchema`
- `jwtAuthErrorResponseSchema`
- `jwtAuthValidationResponseSchema`

Use these when building custom login/session flows so you can share the same runtime validation and context-auth patterns as the built-in bridge.

## Term actions (categories, tags, custom taxonomies)

```ts
import {
  WordPressClient,
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
} from 'wp-astrojs-integration';

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
import { WordPressClient, postSchema, wordPressPostLoader } from 'wp-astrojs-integration';
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
| Best for | SSR and frequently changing content | SSG and stable content |
| Astro API | `defineLiveCollection` | `defineCollection` |
| Content APIs | `getLiveEntry`, `getLiveCollection` | `getEntry`, `getCollection` |
| Post/page payload shape | Plain serializable objects | Plain serializable objects |

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
