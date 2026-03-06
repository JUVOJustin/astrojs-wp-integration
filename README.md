# WordPress Astro.js Integration

Ready to use WordPress integration for Astro.js with live loaders, static loaders, client API, and Gutenberg block support.

## Features

- **Client-First Core**: `WordPressClient` is the base layer; loaders, actions, and bridges build on top of stable client behavior
- **Live Loaders**: Real-time data fetching from WordPress REST API (server-side rendering)
- **Static Loaders**: Build-time data fetching for static site generation
- **WordPress Client**: Direct runtime API access for dynamic content
- **Auth Action Bridge**: Pre-shipped Astro server action bridge with JWT login and middleware helpers
- **Gutenberg Support**: Automatic block styles loading for proper rendering
- **TypeScript First**: Fully typed with extensible schemas
- **Easy Extension**: Simple API for adding custom ACF fields, post types, taxonomies, and plugin data
- **Optimized Images**: Responsive image component with srcset support

## Architecture Principles

- Start with `WordPressClient` when adding new WordPress support. Higher-level APIs should only be added after the underlying client behavior exists and is validated.
- Assume and validate the minimum required data for each feature. Keep custom fields, meta, taxonomies, post types, actions, and plugin endpoints extensible instead of forcing a narrow core-data shape.
- Prefer WordPress-native flexibility over package-specific constraints so custom REST resources can reuse the same patterns as core entities.

## Installation

```bash
npm install wp-astrojs-integration
```

## Available Entities

| Entity | Schema Name | Live Loader | Static Loader | Notes |
|--------|-------------|-------------|---------------|-------|
| Posts | `postSchema` | `wordPressPostLoader` | `wordPressPostStaticLoader` | |
| Pages | `pageSchema` | `wordPressPageLoader` | `wordPressPageStaticLoader` | |
| Media | `mediaSchema` | `wordPressMediaLoader` | `wordPressMediaStaticLoader` | |
| Categories | `categorySchema` | `wordPressCategoryLoader` | `wordPressCategoryStaticLoader` | |
| Tags | `categorySchema` | - | `wordPressTagStaticLoader` | |
| Users | `WordPressAuthor` | `wordPressUserLoader` | `wordPressUserStaticLoader` | |
| Settings | `settingsSchema` | - | - | Client-only, requires auth |

## Quick Start

### Option 1: Live Collections (Server-Side Rendering)

Use [live loaders](https://docs.astro.build/de/reference/experimental-flags/live-content-collections/) for SSR or when you need real-time data:

```typescript
// src/live.config.ts
import { defineLiveCollection } from 'astro:content';
import { wordPressPostLoader, postSchema } from 'wp-astrojs-integration';

const WORDPRESS_BASE_URL = import.meta.env.PUBLIC_WORDPRESS_BASE_URL;

const posts = defineLiveCollection({
  loader: wordPressPostLoader({ baseUrl: WORDPRESS_BASE_URL }),
  schema: postSchema,
});

export const collections = { posts };
```

### Option 2: Static Collections (Build-Time Only)

Use [static loaders](https://docs.astro.build/de/reference/modules/astro-content/) for fully static site generation. Pagination is done automatically.

```typescript
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { wordPressPostStaticLoader, postSchema } from 'wp-astrojs-integration';

const WORDPRESS_BASE_URL = import.meta.env.PUBLIC_WORDPRESS_BASE_URL;

const posts = defineCollection({
  loader: wordPressPostStaticLoader({ baseUrl: WORDPRESS_BASE_URL }),
  schema: postSchema,
});

export const collections = { posts };
```

### Configuration

The `baseUrl` parameter is required for loaders and components. You can provide it directly or use environment variables:

```typescript
// Option 1: Direct configuration
const posts = defineLiveCollection({
  loader: wordPressPostLoader({ baseUrl: 'https://your-wordpress-site.com' }),
  schema: postSchema,
});
```

### Using in Pages

```astro
---
// For live collections
import { getLiveEntry } from 'astro:content';
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
import WPImage from 'wp-astrojs-integration/components/WPImage.astro';

const { slug } = Astro.params;
const { entry: post } = await getLiveEntry('posts', { slug });

const featuredMedia = post.data._embedded?.['wp:featuredmedia']?.[0];
---

<article>
  {featuredMedia && (
    <WPImage media={featuredMedia} loading="eager" />
  )}
  
  <h1 set:html={post.data.title.rendered} />
  
  <WPContent 
    content={post.data.content.rendered}
    baseUrl="https://your-wordpress-site.com"
  />
</article>
```

## Extending with Custom Fields

### Custom ACF Fields

Extend the default schemas with your ACF fields:

```typescript
import { postSchema } from 'wp-astrojs-integration';
import { z } from 'astro/zod';

const customPostSchema = postSchema.extend({
  acf: z.object({
    video_url: z.string().optional(),
    featured_color: z.string().optional(),
    custom_field: z.string().optional(),
  }).optional(),
});

const posts = defineLiveCollection({
  loader: wordPressPostLoader({ baseUrl: WORDPRESS_BASE_URL }),
  schema: customPostSchema,
});
```

### Custom Post Types

Create a custom post type loader:

```typescript
import { contentWordPressSchema } from 'wp-astrojs-integration';
import { z } from 'astro/zod';

const productSchema = contentWordPressSchema.extend({
  acf: z.object({
    price: z.number().optional(),
    sku: z.string().optional(),
  }).optional(),
});

// Use the base loader pattern for custom post types
import { wordPressPostLoader } from 'wp-astrojs-integration';

const products = defineLiveCollection({
  loader: wordPressPostLoader({ baseUrl: WORDPRESS_BASE_URL }),
  schema: productSchema,
});
```

### Custom Taxonomies

Extend category schema for custom taxonomies:

```typescript
import { categorySchema } from 'wp-astrojs-integration';

const customCategorySchema = categorySchema.extend({
  acf: z.object({
    color: z.string().optional(),
    icon: z.string().optional(),
  }).optional(),
});

const categories = defineLiveCollection({
  loader: wordPressCategoryLoader({ baseUrl: WORDPRESS_BASE_URL }),
  schema: customCategorySchema,
});
```

## Components

### WPContent

Renders WordPress Gutenberg content with automatic block styles loading:

```astro
---
import WPContent from 'wp-astrojs-integration/components/WPContent.astro';
---

<WPContent 
  content={post.data.content.rendered}
  baseUrl="https://your-wordpress-site.com"
  class="custom-class"
  loadBlockStyles={true}
/>
```

**Props:**
- `content` (string, required): Rendered HTML from WordPress
- `baseUrl` (string, required): WordPress site URL
- `class` (string): Additional CSS classes
- `loadBlockStyles` (boolean): Load Gutenberg block styles (default: true)

### WPImage

Optimized responsive images with srcset support:

```astro
---
import WPImage from 'wp-astrojs-integration/components/WPImage.astro';
---

<!-- With embedded media -->
<WPImage media={featuredMedia} loading="eager" />

<!-- With media ID -->
<WPImage 
  mediaId={123} 
  baseUrl="https://your-wordpress-site.com"
  loading="lazy"
/>
```

**Props:**
- `media` (object): Pre-loaded media data from `_embedded`
- `mediaId` (number): WordPress media ID
- `baseUrl` (string): Required if using `mediaId`
- `class` (string): CSS classes
- `loading` ('lazy' | 'eager'): Image loading strategy
- `width` (number): Custom width
- `height` (number): Custom height
- `sizes` (string): Responsive sizes attribute

## WordPress Client (Runtime API)

For runtime data fetching:

```typescript
import { WordPressClient } from 'wp-astrojs-integration';

const wp = new WordPressClient({ baseUrl: 'https://your-wordpress-site.com' });

// Get posts
const posts = await wp.getPosts();
const post = await wp.getPostBySlug('my-post');

// Get pages
const pages = await wp.getPages();
const page = await wp.getPageBySlug('about');

// Get media
const media = await wp.getMedia();
const image = await wp.getMediaItem(123);

// Get categories and tags
const categories = await wp.getCategories();
const tags = await wp.getTags();
```

### With Authentication

For endpoints requiring authentication (e.g., `/settings`, `/users/me`) the client supports these direct auth patterns:

```typescript
import { WordPressClient } from 'wp-astrojs-integration';

// Basic auth (application password)
const basicClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: {
    username: 'your-username',
    password: 'your-application-password'
  }
});

// JWT auth (user-scoped SSR/session flows)
const jwtClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: {
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOi...'
  }
});

// Prebuilt authorization header
const headerClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeader: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOi...'
});

// WordPress session cookies
const cookieClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  cookies: 'wordpress_logged_in_xxx=...; wordpress_sec_xxx=...'
});

const currentUser = await headerClient.getCurrentUser();
console.log(currentUser.name, currentUser.email);
```

For signature-based methods (for example OAuth 1.0 style flows), use request-aware auth headers:

```typescript
const signedClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeaders: ({ method, url, body }) => {
    const authorization = createSignedAuthHeader({
      method,
      url: url.toString(),
      body,
    });

    return {
      Authorization: authorization,
    };
  },
});
```

`createSignedAuthHeader` is your own app function for custom auth integrations (for example OAuth 1.0). It just returns a header string; it is not a sub-request and is not provided by this package.

### Astro Actions Authentication Bridge (Pre-Shipped)

Use the packaged bridge to get a ready-to-use JWT login server action with Zod validation and middleware/action helpers.

The bridge uses web-standard runtime APIs so the same flow works in Node and non-Node Astro adapters.

The bridge includes:

- `wordPressLoginInputSchema` for predefined Zod validation (`usernameOrEmail`, `password`, `redirectTo`)
- `loginAction` for Astro Actions
- middleware helpers (`resolveUser`, `isAuthenticated`, `clearAuthentication`)
- action auth helper (`getActionAuth`) for request-scoped JWT auth in `create*PostAction`

The packaged bridge authenticates against `jwt-authentication-for-wp-rest-api`, stores the JWT in an HTTP-only cookie, and reuses that token for authenticated REST API calls.

WordPress must have the JWT plugin enabled and `JWT_AUTH_SECRET_KEY` configured.

```typescript
import { z } from 'astro/zod';
import { wordPressLoginInputSchema } from 'wp-astrojs-integration';

type LoginPayload = z.input<typeof wordPressLoginInputSchema>;
```

```typescript
// src/lib/auth/bridge.ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: 'https://your-wordpress-site.com',
  cookieName: 'collabfinder_session',
});
```

```typescript
// src/actions/index.ts
import { wordPressAuthBridge } from '../lib/auth/bridge';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
} from 'wp-astrojs-integration';

export const server = {
  login: wordPressAuthBridge.loginAction,
  createPost: createCreatePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: (context) => wordPressAuthBridge.getActionAuth(context),
  }),
  updatePost: createUpdatePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: (context) => wordPressAuthBridge.getActionAuth(context),
  }),
  deletePost: createDeletePostAction({
    baseUrl: import.meta.env.WP_URL,
    auth: (context) => wordPressAuthBridge.getActionAuth(context),
  }),
};
```

For OAuth-style signatures, action factories also support request-aware `authHeaders`:

```typescript
const signedActionConfig = {
  baseUrl: import.meta.env.WP_URL,
  authHeaders: {
    fromContext: (context) => ({ method, url, body }) => {
      const authorization = createSignedAuthHeader({
        method,
        url: url.toString(),
        body,
        token: context.locals.oauthToken,
      });

      return {
        Authorization: authorization,
      };
    },
  },
};
```

This pattern is meant for custom auth integrations. The package passes request metadata (`method`, `url`, `body`) into your signer, then forwards the returned headers to WordPress.

```astro
---
// src/pages/login.astro
import { isInputError } from 'astro:actions';
import { actions } from 'astro:actions';

const result = Astro.getActionResult(actions.login);

if (result && !result.error) {
  return Astro.redirect(result.data.redirectTo);
}

const inputErrors = isInputError(result?.error) ? result.error.fields : {};
---

{inputErrors.usernameOrEmail && <p>{inputErrors.usernameOrEmail.join(', ')}</p>}

<form method="POST" action={actions.login}>
  <input type="hidden" name="redirectTo" value="/" />
  <input type="text" name="usernameOrEmail" autocomplete="username" required />
  <input type="password" name="password" autocomplete="current-password" required />
  <button type="submit">Sign in</button>
</form>
```

### Astro Middleware Authentication Example

Protect routes by resolving the authenticated user from the JWT bridge cookie:

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { wordPressAuthBridge } from './lib/auth/bridge';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === '/login') {
    return next();
  }

  const user = await wordPressAuthBridge.resolveUser(context);

  if (!user) {
    wordPressAuthBridge.clearAuthentication(context.cookies);
    return Response.redirect(new URL('/login', context.url), 302);
  }

  context.locals.user = user;

  return next();
});
```

### Protected update action (JWT reused automatically)

After middleware authenticates the request, action calls can reuse the same JWT cookie without manually forwarding headers:

```astro
---
// src/pages/admin/edit-post.astro
import { actions } from 'astro:actions';

if (!Astro.locals.user) {
  return Astro.redirect('/login');
}

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData();
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') ?? '').trim();

  const { data, error } = await Astro.callAction(actions.updatePost, { id, title });

  if (error) {
    throw error;
  }

  return Astro.redirect(`/admin/posts/${data.id}`);
}
---

<form method="POST">
  <input type="hidden" name="id" value="123" />
  <input type="text" name="title" value="Updated from Astro" required />
  <button type="submit">Update post</button>
</form>
```

Then access the authenticated user in your protected routes:

```astro
---
// src/pages/admin/index.astro
const user = Astro.locals.user;
---
<h1>Welcome, {user.name}!</h1>
```

## API Reference

### Live Loaders (for `defineLiveCollection`)

Use these for server-side rendering or real-time data:

- `wordPressPostLoader(config)`: Live loader for posts
- `wordPressPageLoader(config)`: Live loader for pages
- `wordPressMediaLoader(config)`: Live loader for media
- `wordPressCategoryLoader(config)`: Live loader for categories/taxonomies
- `wordPressUserLoader(config)`: Live loader for users

### Static Loaders (for `defineCollection`)

Use these for static site generation (build-time only):

- `wordPressPostStaticLoader(config)`: Static loader for posts
- `wordPressPageStaticLoader(config)`: Static loader for pages
- `wordPressMediaStaticLoader(config)`: Static loader for media
- `wordPressCategoryStaticLoader(config)`: Static loader for categories
- `wordPressTagStaticLoader(config)`: Static loader for tags
- `wordPressUserStaticLoader(config)`: Static loader for users

**Static Loader Config:**
```typescript
interface WordPressStaticLoaderConfig {
  baseUrl: string;
  auth?: WordPressAuthConfig;
  authHeader?: string;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  cookies?: string;
  perPage?: number;  // Items per page (default: 100)
  params?: Record<string, string>;  // Additional query params
}
```

### Server Authentication Bridge

- `createWordPressAuthBridge(config)`: Creates a packaged Astro JWT login bridge with middleware/action helpers
- `wordPressLoginInputSchema`: Predefined Zod schema for login payload validation

### Low-Level Client Transport

- `WordPressClient.request(options)`: Execute custom REST requests while reusing configured auth/cookies on relative, full REST, or same-origin absolute URLs
- `WordPressRequestOptions`: Type for request method, endpoint, params, body, and auth overrides
- `WordPressRequestResult<T>`: Typed response payload with the original `Response`

### Auth Utilities

- `createBasicAuthHeader(credentials)`: Build a Basic Authorization header
- `createJwtAuthHeader(token)`: Build a Bearer Authorization header for JWT tokens
- `createWordPressAuthHeader(auth)`: Build Authorization header from basic/JWT/prebuilt auth config
- `resolveWordPressRequestHeaders(config)`: Build final request headers from static auth and request-aware auth providers

Detailed setup docs: https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/auth-action-bridge.md

Client guide: https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/client-usage.md

### Server Actions

- Post actions (create, update, delete): https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/actions/posts.mdx
- Ability actions (get, run, delete): https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/actions/abilities.mdx
- Actions overview (auth, validation, errors): https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/actions/index.mdx

### Schemas

Default schemas for WordPress content:

- `baseWordPressSchema`: Base fields for all content
- `contentWordPressSchema`: Content-specific fields (posts/pages)
- `postSchema`: WordPress posts
- `pageSchema`: WordPress pages
- `mediaSchema`: WordPress media
- `categorySchema`: Categories and taxonomies
- `embeddedMediaSchema`: Embedded media from `_embedded` field
- `abilitySchema`: WordPress ability objects
- `abilityAnnotationsSchema`: Ability `meta.annotations` block
- `abilityCategorySchema`: Ability categories

### Types

TypeScript types inferred from schemas:

- `WordPressPost`
- `WordPressPage`
- `WordPressMedia`
- `WordPressCategory`
- `WordPressTag`
- `WordPressAuthor`
- `WordPressEmbeddedMedia`
- `WordPressAbility`
- `WordPressAbilityAnnotations`
- `WordPressAbilityCategory`

## Live vs Static Loaders

| Feature | Live Loaders | Static Loaders |
|---------|-------------|----------------|
| Data freshness | Real-time | Build-time snapshot |
| Use case | SSR, dynamic content | SSG, static sites |
| Performance | Fetches on each request | Fetches once at build |
| Astro API | `defineLiveCollection` | `defineCollection` |
| Content access | `getLiveEntry`, `getLiveCollection` | `getEntry`, `getCollection` |

## Why This Package?

- **Flexible**: Choose between live (SSR) and static (SSG) data fetching
- **Type Safety**: Full TypeScript support with extensible schemas
- **Gutenberg Ready**: Automatic block styles ensure proper rendering
- **Easy Extension**: Simple API for custom fields and post types
- **Modern Workflow**: Works seamlessly with Astro's content collections
- **Optimized**: Responsive images, efficient caching, and minimal overhead

## Development & Testing

This project uses integration tests that run against a real WordPress instance via [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) (Docker). Test content (150 posts, 10 pages, categories, tags) is automatically seeded on every `wp-env start` via a lifecycle script. Native REST meta is also seeded for known entries (`test-post-001`, `about`, `test-book-001`) so loader suites can verify meta passthrough behavior.

Repository guidance for contributors and AI agents lives in `AGENTS.md`. It is intentionally kept out of the published npm package because `package.json` only publishes `dist/` and `src/components/`.

ACF-based integration tests rely on the free ACF plugin, which is auto-activated when already installed or installed+activated when missing during `npm run wp:start`.

JWT auth integration tests rely on `jwt-authentication-for-wp-rest-api`, which follows the same activate-or-install flow during `npm run wp:start`.

Reference suites for full CRUD examples:

- `tests/integration/actions/posts.test.ts` — core post CRUD
- `tests/integration/actions/auth-bridge.test.ts` — JWT auth bridge middleware/action helper coverage
- `tests/integration/actions/pages.test.ts` — core page CRUD
- `tests/integration/actions/books.test.ts` — core CPT (`book`) CRUD
- `tests/integration/actions/acf.test.ts` — ACF CRUD with simple (text/number/url) and complex relation fields; relation values are validated as IDs and with `_links['acf:post']`/`_embedded['acf:post']` on `_embed=1` fetches
- `tests/integration/actions/meta.test.ts` — core meta CRUD with simple, complex, and subtype-specific custom fields
- `tests/integration/actions/abilities.test.ts` — ability actions (GET/POST/DELETE) with simple, complex, and invalid input schemas

```bash
npm run wp:start   # Start WordPress Docker container (seeds data automatically)
npm test           # Run all integration tests
npm run test:watch # Run in watch mode
npm run wp:stop    # Stop the container
npm run wp:clean   # Destroy container and volumes
```

Tests also run automatically via GitHub Actions on pull requests and pushes to `main`.

## License

MIT
