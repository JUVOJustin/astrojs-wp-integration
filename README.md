# WordPress Astro.js Integration

Astro-first integration for WordPress with content loaders, server actions, auth bridge helpers, and rendering components.

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
| Tags | `categorySchema` | - | `wordPressTagStaticLoader` | Static only |
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

export const server = {
  createPost: createCreatePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
  updatePost: createUpdatePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
  deletePost: createDeletePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
  createUser: createCreateUserAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
  updateUser: createUpdateUserAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
  deleteUser: createDeleteUserAction({
    baseUrl: import.meta.env.WP_URL,
    auth: {
      username: import.meta.env.WP_USERNAME,
      password: import.meta.env.WP_APP_PASSWORD,
    },
  }),
};
```

Action factories accept an optional `responseSchema` that follows the Standard Schema spec (for example Zod schemas).

## Auth bridge

```ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  cookieName: 'wp_user_session',
});
```

## Auth utility exports

The package re-exports auth helpers from `fluent-wp-client`, including:

- `createAuthResolver`
- `jwtAuthTokenResponseSchema`
- `jwtAuthErrorResponseSchema`
- `jwtAuthValidationResponseSchema`

Use these when building custom login/session flows so you can share the same runtime validation and context-auth patterns as the built-in bridge.

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

## Development and testing

```bash
npm run wp:start
npm test
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
- `tests/setup/global-setup.ts` provisions app password, JWT, and cookie+nonce fixtures.
- `tests/integration/` contains Astro-facing integration coverage for loaders, actions, auth bridge behavior, meta, ACF, and abilities.

## Docs

- Auth bridge: `docs/auth-action-bridge.md`
- Action overview: `docs/actions/index.mdx`
- Post actions: `docs/actions/posts.mdx`
- User actions: `docs/actions/users.mdx`
- Ability actions: `docs/actions/abilities.mdx`

## License

MIT
