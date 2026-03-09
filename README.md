# WordPress Astro.js Integration

Astro loaders, server actions, auth helpers, and components for WordPress, built on top of the published `fluent-wp-client` package.

## Install

```bash
npm install wp-astrojs-integration fluent-wp-client
```

`wp-astrojs-integration` provides Astro-facing APIs.

`fluent-wp-client` is now consumed as a normal npm dependency instead of a local workspace package.

## What this package includes

- Live loaders for Astro live collections
- Static loaders for Astro content collections
- Astro server action factories for posts, pages, custom post types, and WordPress abilities
- JWT-based Astro auth bridge helpers
- `WPContent` and `WPImage` components
- Re-exports for the published `fluent-wp-client` schemas, types, auth helpers, and `WordPressClient`

## Architecture

- `WordPressClient` from `fluent-wp-client` is the core integration layer
- Astro loaders, actions, and auth helpers are thin wrappers around published client behavior
- Custom post types, taxonomies, meta, ACF fields, and plugin endpoints should reuse the same generic client patterns

## Quick start

### Live collections

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

### Static collections

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

### Runtime client usage

```ts
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
});

const posts = await wp.getPosts();
const post = await wp.getPostBySlug('hello-world');
const books = await wp.content('books').getAll();
```

### WPAPI-style request builder

```ts
const posts = await wp.posts().perPage(10).page(1).embed().get();
const created = await wp.posts().create({ title: 'Hello', status: 'draft' });
const book = await wp.namespace('wp/v2').route('books').slug('test-book-001').get();
```

### Astro actions

```ts
import {
  createCreatePostAction,
  createDeletePostAction,
  createUpdatePostAction,
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
};
```

The low-level `execute*` helpers now also accept `baseUrl` directly:

```ts
import { executeCreatePost } from 'wp-astrojs-integration/actions';
import { createBasicAuthHeader } from 'wp-astrojs-integration';

const product = await executeCreatePost(
  {
    baseUrl: 'https://example.com',
    authHeader: createBasicAuthHeader({ username: 'admin', password: 'app-password' }),
    resource: 'products',
  },
  {
    title: 'Running Shoes',
    status: 'publish',
  },
);
```

## Auth bridge

```ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: import.meta.env.WP_URL,
  cookieName: 'wp_user_session',
});
```

The bridge now uses published client capabilities for JWT login and authenticated user resolution.

## Components

### `WPContent`

```astro
---
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
---

<WPContent
  content={post.data.content.rendered}
  baseUrl="https://your-wordpress-site.com"
/>
```

### `WPImage`

```astro
---
import WPImage from 'wp-astrojs-integration/components/WPImage.astro';
---

<WPImage media={featuredMedia} loading="eager" />
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

## Available entities

| Entity | Schema | Live loader | Static loader |
|---|---|---|---|
| Posts | `postSchema` | `wordPressPostLoader` | `wordPressPostStaticLoader` |
| Pages | `pageSchema` | `wordPressPageLoader` | `wordPressPageStaticLoader` |
| Media | `mediaSchema` | `wordPressMediaLoader` | `wordPressMediaStaticLoader` |
| Categories | `categorySchema` | `wordPressCategoryLoader` | `wordPressCategoryStaticLoader` |
| Tags | `categorySchema` | - | `wordPressTagStaticLoader` |
| Users | `WordPressAuthor` | `wordPressUserLoader` | `wordPressUserStaticLoader` |

## Development and testing

This repository now ships one npm package and consumes `fluent-wp-client` from npm.

Root scripts use `wp-env` directly:

```bash
npm run wp:start
npm test
npm run wp:stop
```

Other available commands:

```bash
npm run test:watch
npm run wp:clean
npm run wp:status
npm run build
```

### Local integration test environment

- `.wp-env.json` defines the local WordPress environment
- `tests/wp-env/` contains mu-plugins and seeded content
- `tests/setup/global-setup.ts` provisions app-password, JWT, and cookie+nonce auth fixtures
- `tests/integration/` contains Astro-facing integration coverage for loaders, actions, auth bridge behavior, meta, ACF, and abilities
- Integration suites prioritize Astro wrapper behavior (action schemas, auth resolution, loader/store contracts, error mapping); deep WordPress REST semantics are primarily covered in `fluent-wp-client`

Seeded content includes posts, pages, tags, categories, books, native REST meta, ACF fields, and test abilities.

## Docs

- Auth bridge: `docs/auth-action-bridge.md`
- Astro abilities: `docs/abilities.md`
- Action overview: `docs/actions/index.mdx`
- Post actions: `docs/actions/posts.mdx`
- Ability actions: `docs/actions/abilities.mdx`
- Published client usage: https://github.com/JUVOJustin/fluent-wp-client/blob/main/docs/usage.md
- Published client abilities: https://github.com/JUVOJustin/fluent-wp-client/blob/main/docs/abilities.md
- Published client migration guide: https://github.com/JUVOJustin/fluent-wp-client/blob/main/docs/migration-from-node-wpapi.md

## License

MIT
