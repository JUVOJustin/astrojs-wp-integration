# WordPress Astro.js Integration

Astro-first integration for WordPress with content loaders, server actions, auth bridge helpers, catalog virtual modules, and rendering components.

This package is built against `fluent-wp-client` `^3.1.0` and expects your Astro project to use the same client package directly. It supports Astro `^7.4.7`.

## Install

```bash
pnpm add wp-astrojs-integration fluent-wp-client
```

If you use a coding agent, install both the fluent client and Astro integration skills:

```bash
pnpm dlx skills add https://github.com/JUVOJustin/fluent-wp-client
pnpm dlx skills add https://github.com/JUVOJustin/astrojs-wp-integration
```

## Runtime environment

The examples use a server-side WordPress URL declared in the consuming Astro application. Add it to the existing config and set `WORDPRESS_URL` through your hosting environment or local environment file:

```js title="astro.config.mjs"
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  env: {
    schema: {
      WORDPRESS_URL: envField.string({
        context: 'server',
        access: 'public',
        url: true,
      }),
    },
  },
});
```

Read it with `import { WORDPRESS_URL } from 'astro:env/server'`. Declare credentials with server context and secret access, or use `getSecret()` for dynamically named secrets. Build-time catalog configuration still uses the documented `WP_CATALOG_*` variables; it runs outside Astro's request runtime.

## Feature overview

| Feature | What you get in Astro | Main API |
| --- | --- | --- |
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
| --- | --- | --- | --- | --- |
| Posts | `postSchema` | `wordPressPostLoader` | `wordPressPostStaticLoader` |  |
| Pages | `pageSchema` | `wordPressPageLoader` | `wordPressPageStaticLoader` |  |
| Media | `mediaSchema` | `wordPressMediaLoader` | `wordPressMediaStaticLoader` |  |
| Categories | `categorySchema` | `wordPressCategoryLoader` | `wordPressCategoryStaticLoader` |  |
| Tags | `categorySchema` | `wordPressTagLoader` | `wordPressTagStaticLoader` |  |
| Custom taxonomies | `categorySchema` | `wordPressTermLoader` | `wordPressTermStaticLoader` | Pass custom REST `resource` |
| Custom Post Types | `contentWordPressSchema` (extend) | `wordPressContentLoader` | `wordPressContentStaticLoader` | Pass custom REST `resource` |
| Users | `WordPressAuthor` | `wordPressUserLoader` | `wordPressUserStaticLoader` |  |

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

Set the WordPress URL in `.env` or in the environment that runs Astro.

```bash title=".env"
WP_CATALOG_URL=https://cms.example.com
```

Catalog setup uses Vite's supported `loadEnv()` helper during Astro setup, so `.env` files and shell or CI variables are available. Authenticated discovery can use `WP_CATALOG_AUTH_HEADER` or `WP_CATALOG_USERNAME` plus `WP_CATALOG_PASSWORD`; username/password credentials use JWT when WordPress exposes the `/jwt-auth/v1/token` route in the REST index (served at `/wp-json/jwt-auth/v1/token`) and otherwise use application-password basic auth.

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
import { withWordPressActionSchemas } from 'virtual:wp-astrojs/schemas';
import { createCreatePostAction } from 'wp-astrojs-integration';

import { wp } from '../lib/wp';

export const server = {
  createBook: createCreatePostAction(
    wp,
    withWordPressActionSchemas('books', { resource: 'books' })
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
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostLoader } from 'wp-astrojs-integration/loaders';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: postSchema,
});

export const collections = { posts };
```

If you need request instrumentation, a cache layer, or a proxy, pass a custom `fetch` to `WordPressClient` and then reuse that client with the live loader:

```ts
import { WORDPRESS_URL } from 'astro:env/server';
const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
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
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostStaticLoader } from 'wp-astrojs-integration/loaders';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
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
const acfFields = await wp
  .content('posts')
  .getSchemaValue<
    Record<string, { choices?: Array<{ value: string; label: string }> }>
  >('properties.acf.properties');

const choiceLabels = new Map(
  Object.entries(acfFields ?? {})
    .filter(([, field]) => Array.isArray(field.choices))
    .map(([fieldName, field]) => [
      fieldName,
      new Map(field.choices!.map((choice) => [choice.value, choice.label])),
    ])
);

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp, {
    mapEntry: (post) => ({
      ...post,
      acf: Object.fromEntries(
        Object.entries(post.acf ?? {}).map(([fieldName, value]) => [
          fieldName,
          choiceLabels.get(fieldName)?.get(String(value)) ?? value,
        ])
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

| Server-side tool group | Factories from `fluent-wp-client/ai-sdk` | Use for |
| --- | --- | --- |
| Content | `getContentTool`, `getContentCollectionTool`, `saveContentTool`, `deleteContentTool` | Posts, pages, custom post types, and other post-like resources |
| Terms | `getTermTool`, `getTermCollectionTool`, `saveTermTool`, `deleteTermTool` | Categories, tags, and custom taxonomies |
| Generic resources | `getResourceTool`, `getResourceCollectionTool`, `saveResourceTool`, `deleteResourceTool` | Catalog-discovered or plugin REST resources |
| Abilities | `getAbilitiesTool`, `getAbilityTool`, `executeGetAbilityTool`, `executeRunAbilityTool`, `executeDeleteAbilityTool`, `createAbilityTools` | WordPress abilities exposed through the REST API |
| Blocks | `getBlocksTool`, `setBlocksTool` | Reading or writing parsed block content |
| Settings | `getSettingsTool`, `updateSettingsTool` | WordPress site settings |
| Discovery | `describeResourceTool` | Resource metadata and schema-aware descriptions |

For public AI reads, use the fluent client tools directly and apply any Astro route cache policy in the endpoint:

```ts
import type { APIRoute } from 'astro';
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import { getContentTool } from 'fluent-wp-client/ai-sdk';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
});

export const GET: APIRoute = async (context) => {
  const tool = getContentTool(wp, {
    contentType: 'posts',
  });

  if (!tool.execute) throw new Error('Content tool is not executable.');

  const result = await tool.execute(
    { slug: 'hello-world' },
    {
      toolCallId: 'read-post',
      messages: [],
    }
  );

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

  const result = await tool.execute(
    { slug: 'hello-world' },
    {
      toolCallId: 'read-post',
      messages: [],
    }
  );

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
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import {
  createCreatePostAction,
  createDeletePostAction,
  createUpdatePostAction,
  createCreateUserAction,
  createDeleteUserAction,
  createUpdateUserAction,
} from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
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

The auth bridge is the central client-first request-auth layer for Astro middleware and actions. Helpers like `resolveUser()` and `isAuthenticated()` only reflect end-user request auth. `getClient()` and `getClientConfig()` can opt into bridge-level static credentials with `{ allowStaticAuthFallback: true }` when you explicitly want a service-client fallback.

```ts
import { WORDPRESS_URL } from 'astro:env/server';
import { defineMiddleware } from 'astro:middleware';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
  createWordPressAuthBridge,
} from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: WORDPRESS_URL,
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
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
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
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import {
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
} from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
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
import { z } from 'astro/zod';
import { WORDPRESS_URL } from 'astro:env/server';
import { WordPressClient } from 'fluent-wp-client';
import { postSchema } from 'fluent-wp-client/zod';
import { wordPressPostLoader } from 'wp-astrojs-integration/loaders';

const wp = new WordPressClient({
  baseUrl: WORDPRESS_URL,
});

const customPostSchema = postSchema.extend({
  acf: z
    .object({
      video_url: z.string().optional(),
      featured_color: z.string().optional(),
    })
    .optional(),
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader(wp),
  schema: customPostSchema,
});
```

## Live vs static loaders

| Feature | Live loaders | Static loaders |
| --- | --- | --- |
| Freshness | Request-time | Build-time |
| Best for | SSR and frequently changing public/shared content | SSG and stable content |
| Astro API | `defineLiveCollection` | `defineCollection` |
| Content APIs | `getLiveEntry`, `getLiveCollection` | `getEntry`, `getCollection` |
| Post/page payload shape | Plain serializable objects | Plain serializable objects |

Live loaders accept fluent-wp-client collection filters through `getLiveCollection()`, including `search`, `include`, `exclude`, taxonomy filters, `slug`, and custom query params. Static loaders accept the same build-time query shape through `options.filter`; the filter is passed to `listAll()` and all matching pages are fetched during the build.

## Development and testing

```bash
pnpm run wp:start
pnpm run wp:status
pnpm test                    # Run all test projects
pnpm run test:integration    # Integration project (actions/loaders/auth)
pnpm run test:build          # Static build project
pnpm run wp:stop
```

`wp-env` uses automatic port selection in this repository. If `8888` is unavailable, run `pnpm run wp:status` to see the active local WordPress URL and ports.

Other useful commands:

```bash
pnpm run test:watch
pnpm run wp:clean
pnpm run wp:status
pnpm run build
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

## Development and compatibility

Use Node.js 24 LTS and the pnpm version pinned in `package.json`. Version 0.6 targets Astro 7 and `fluent-wp-client` 3.1; Astro 6 applications must upgrade before adopting it. TypeScript stays on 6 because the current Astro checker and TypeScript ESLint parser do not support TypeScript 7.

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run format:check
pnpm run check:types
pnpm run check:astro
pnpm run build
pnpm run wp:start
pnpm test
pnpm run wp:stop
pnpm pack --out /tmp/wp-astrojs-integration.tgz
```

Oxlint/Oxfmt use Ultracite core, Astro, Vitest and Anti-Slop presets. Astro templates have separate ESLint/Prettier commands, and PHP test fixtures are excluded from shared formatting. Existing declaration style and full-stack assertion patterns have explicit rule overrides; boundary casts and open WordPress metadata have local explanations. See the config files for exact coverage. Lefthook fixes staged files before commits and runs checks, build and integration tests before pushes. Docker and a started WordPress test environment are required for the latter.

This is a library, not a hosted application. Consumers choose their adapter, runtime, cache lifetime and persistence. The catalog integration owns build-time filesystem access; runtime loaders and auth helpers use the published WordPress client and web APIs. No Effect boundary or application database is introduced. Prefer `wp-astrojs-integration/loaders` in content configuration to avoid loading server actions during content sync.

Catalog environment variables are documented in `.env.schema`. Use local environment values with Varlock; no private password-manager account or company tooling is required for contributors. Test credentials are created only for the local disposable WordPress environment. Do not use the public fixture JWT secret in production.

## Releases

Maintainers update `package.json` in a reviewed pull request before releasing. Commit any resulting `pnpm-lock.yaml` change and pass all CI checks. Then publish a GitHub release with a tag matching that version (optional `v` prefix). The Publish workflow verifies the version, runs checks/build/tests and publishes through npm trusted publishing with provenance. The workflow rejects a mismatch between the version and GitHub prerelease flag. The npm dist-tag is derived from the version: prereleases use `next`, stable releases use `latest`. Only the publish job receives OIDC permission; WordPress tests run in a separate job.

Configure npm trusted publishing for this repository's `deploy.yml` workflow before the first publication. The workflow does not commit version changes back to the default branch.

The Astro checker uses the stable `@emnapi/runtime` 1.x peer because its WASM compiler is incompatible with the automatically selected 2.x beta. The explicit esbuild development dependency keeps Vite on the patched 0.28 release line. Recheck both compatibility pins when upgrading the tools.

Packages must be packed and published with pnpm: `.pnpmfile.mjs` strips contributor scripts from the published manifest, so installing the package does not run the repository’s pnpm guard or Git hooks.

Dependabot automatically merges qualifying npm/pnpm updates only after the PR checks pass. GitHub Actions updates require maintainer review and merge. Merges made with `GITHUB_TOKEN` do not trigger another `push` workflow on `main`; use the workflows’ manual dispatch when an additional run is needed.
