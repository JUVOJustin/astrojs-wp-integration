# WordPress Astro.js Integration

Astro-first integration for WordPress with content loaders, server actions, auth bridge helpers, and rendering components.

This package is built against `fluent-wp-client` `^2.1.0`.
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
| Custom Post Types | `postSchema` (extend) | `wordPressContentLoader` | `wordPressContentStaticLoader` | Pass custom REST `resource` |
| Users | `WordPressAuthor` | `wordPressUserLoader` | `wordPressUserStaticLoader` | |

## Quick start

### 1) Live collection (SSR)

```ts
import { defineLiveCollection } from 'astro:content';
import { postSchema, wordPressPostLoader } from 'wp-astrojs-integration';

const posts = defineLiveCollection({
  loader: wordPressPostLoader({
    baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
  }),
  schema: postSchema,
});

export const collections = { posts };
```

### 2) Static collection (SSG)

```ts
import { defineCollection } from 'astro:content';
import { postSchema, wordPressPostStaticLoader } from 'wp-astrojs-integration';

const posts = defineCollection({
  loader: wordPressPostStaticLoader({
    baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
  }),
  schema: postSchema,
});

export const collections = { posts };
```

### 3) Render WordPress content in Astro pages

```astro
---
import { getLiveEntry } from 'astro:content';
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
import WPImage from 'wp-astrojs-integration/components/WPImage.astro';

const { slug } = Astro.params;
const { entry: post } = await getLiveEntry('posts', { slug });
const featuredMedia = post.data._embedded?.['wp:featuredmedia']?.[0];
---

<article>
  {featuredMedia && <WPImage media={featuredMedia} loading="eager" />}
  <h1 set:html={post.data.title.rendered} />
  <WPContent content={post.data.content.rendered} baseUrl={import.meta.env.PUBLIC_WORDPRESS_BASE_URL} />
</article>
```

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

const wpConfig = {
  baseUrl: import.meta.env.WP_URL,
  auth: {
    username: import.meta.env.WP_USERNAME,
    password: import.meta.env.WP_APP_PASSWORD,
  },
};

export const server = {
  createPost: createCreatePostAction(wpConfig),
  updatePost: createUpdatePostAction(wpConfig),
  deletePost: createDeletePostAction(wpConfig),
  createUser: createCreateUserAction(wpConfig),
  updateUser: createUpdateUserAction(wpConfig),
  deleteUser: createDeleteUserAction(wpConfig),
};
```

Action factories accept an optional `responseSchema` that follows the Standard Schema spec (for example Zod schemas).

## Auth bridge

The auth bridge now supports unified auth configuration aligned with `WordPressClientConfig` patterns used by loaders and actions:

```ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

// Basic cookie-based JWT
export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  cookieName: 'wp_user_session',
});

// With static auth (service-to-service)
export const serviceBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  auth: { username: 'api-user', password: 'app-password' },
});

// With custom auth resolver
export const customBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  authResolver: createAuthResolver((context) => {
    const token = context.cookies.get('custom_auth')?.value;
    return token ? { token } : null;
  }),
});
```

Note: `getActionAuth()`, `resolveUser()`, and `isAuthenticated()` are now async and support the unified auth resolver patterns.

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
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
} from 'wp-astrojs-integration';

const wpConfig = {
  baseUrl: import.meta.env.WP_URL,
  auth: {
    username: import.meta.env.WP_USERNAME,
    password: import.meta.env.WP_APP_PASSWORD,
  },
};

export const server = {
  createCategory: createCreateTermAction({ ...wpConfig, resource: 'categories' }),
  updateTag: createUpdateTermAction({ ...wpConfig, resource: 'tags' }),
  deleteGenre: createDeleteTermAction({ ...wpConfig, resource: 'genres' }),
};
```

## Extending schemas

```ts
import { postSchema, wordPressPostLoader } from 'wp-astrojs-integration';
import { z } from 'astro/zod';

const customPostSchema = postSchema.extend({
  acf: z.object({
    video_url: z.string().optional(),
    featured_color: z.string().optional(),
  }).optional(),
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader({
    baseUrl: import.meta.env.PUBLIC_WORDPRESS_BASE_URL,
  }),
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
npm test                    # Run all test projects
npm run test:integration    # Integration project (actions/loaders/auth)
npm run test:build          # Static build project
npm run wp:stop
```

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
- `tests/fixtures/astro-site/` is the shared Astro fixture used by integration action tests (`astro dev` + `/_actions/*`) and the build integration test (`astro build` with `ASTRO_TEST_MODE=build`).
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
