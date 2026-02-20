# WordPress Astro.js Integration

Ready to use WordPress integration for Astro.js with live loaders, static loaders, client API, and Gutenberg block support.

## Features

- **Live Loaders**: Real-time data fetching from WordPress REST API (server-side rendering)
- **Static Loaders**: Build-time data fetching for static site generation
- **WordPress Client**: Direct runtime API access for dynamic content
- **Auth Action Bridge**: Pre-shipped Astro server action with Zod-validated WordPress login
- **Gutenberg Support**: Automatic block styles loading for proper rendering
- **TypeScript First**: Fully typed with extensible schemas
- **Easy Extension**: Simple API for adding custom ACF fields, post types, and taxonomies
- **Optimized Images**: Responsive image component with srcset support

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

For endpoints requiring authentication (e.g., `/settings`, `/users/me`):

```typescript
import { WordPressClient } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: {
    username: 'your-username',
    password: 'your-application-password'
  }
});

// Get WordPress site settings (requires auth)
const settings = await wp.getSettings();
console.log(settings.title, settings.description);

// Get current authenticated user
const currentUser = await wp.getCurrentUser();
console.log(currentUser.name, currentUser.email);
```

### Astro Actions Authentication Bridge (Pre-Shipped)

Use the packaged bridge to get a ready-to-use login server action with Zod validation and automatic cookie handling.

The bridge includes:

- `wordPressLoginInputSchema` for predefined Zod validation (`email`, `password`, `redirectTo`)
- `loginAction` for Astro Actions
- session helpers for middleware (`resolveUserBySessionId`, `clearAuthentication`)

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

export const server = {
  login: wordPressAuthBridge.loginAction,
};
```

```astro
---
// src/pages/login.astro
import { wordPressAuthBridge } from '../lib/auth/bridge';

const result = await Astro.callAction(wordPressAuthBridge.loginAction, {
  email: 'creator@example.com',
  password: 'secret',
  redirectTo: '/',
});

if (!result.error) {
  return Astro.redirect(result.data.redirectTo);
}
---
```

### Astro Middleware Authentication Example

Protect routes by resolving the authenticated user through the dynamic user loader and bridge session:

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { wordPressAuthBridge } from './lib/auth/bridge';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === '/login') {
    return next();
  }

  const sessionId = context.cookies.get(wordPressAuthBridge.cookieName)?.value;
  const user = await wordPressAuthBridge.resolveUserBySessionId(sessionId);

  if (!user) {
    wordPressAuthBridge.clearAuthentication(context.cookies, sessionId);
    return Response.redirect(new URL('/login', context.url), 302);
  }

  context.locals.user = user;

  return next();
});
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
  auth?: BasicAuthCredentials;
  perPage?: number;  // Items per page (default: 100)
  params?: Record<string, string>;  // Additional query params
}
```

### Server Authentication Bridge

- `createWordPressAuthBridge(config)`: Creates a packaged Astro action login bridge with cookie/session helpers
- `wordPressLoginInputSchema`: Predefined Zod schema for login payload validation

Detailed setup docs: https://github.com/JUVOJustin/astrojs-wp-integration/blob/main/docs/auth-action-bridge.md

### Schemas

Default schemas for WordPress content:

- `baseWordPressSchema`: Base fields for all content
- `contentWordPressSchema`: Content-specific fields (posts/pages)
- `postSchema`: WordPress posts
- `pageSchema`: WordPress pages
- `mediaSchema`: WordPress media
- `categorySchema`: Categories and taxonomies
- `embeddedMediaSchema`: Embedded media from `_embedded` field

### Types

TypeScript types inferred from schemas:

- `WordPressPost`
- `WordPressPage`
- `WordPressMedia`
- `WordPressCategory`
- `WordPressTag`
- `WordPressAuthor`
- `WordPressEmbeddedMedia`

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

## License

MIT
