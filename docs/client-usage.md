# WordPress Client Usage

This guide covers how to use `WordPressClient` directly, especially for endpoints that do not yet have dedicated helpers in this package.

`WordPressClient` is the package's foundation. New WordPress support should land here before it is wrapped by loaders, actions, or higher-level helpers.

## When to use the client directly

Use the built-in `getPosts()`, `getPages()`, `getUsers()`, etc. when available.

Use `WordPressClient.request()` when you need:

- custom post types without dedicated wrappers
- custom taxonomies or term endpoints beyond the built-in helpers
- plugin endpoints outside `/wp/v2`
- write operations not yet covered by action factories
- custom auth integrations with request signing (for example OAuth-style signatures)

When adding new package capabilities, prefer extending the client in a way that keeps the surface generic enough for core entities, custom post types, custom taxonomies, plugin namespaces, and custom field payloads.

## Create a client

```ts
import { WordPressClient } from 'wp-astrojs-integration';

const wp = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
});
```

## Direct auth patterns

```ts
import { WordPressClient } from 'wp-astrojs-integration';

// Basic auth
const basicClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: {
    username: 'admin',
    password: 'your-application-password',
  },
});

// JWT token
const jwtClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: {
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOi...',
  },
});

// Prebuilt authorization header
const headerClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeader: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOi...',
});

// Cookie-based session
const cookieClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  cookies: 'wordpress_logged_in_xxx=...; wordpress_sec_xxx=...',
});

// Request-aware signing (OAuth-style)
const signedClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeaders: ({ method, url, body }) => ({
    Authorization: createSignedAuthHeader({
      method,
      url: url.toString(),
      body,
    }),
  }),
});
```

`createSignedAuthHeader` is your own helper for custom auth integrations. It computes one header string from request data and does not call WordPress on its own.

## Use dedicated helpers when possible

```ts
const posts = await wp.getPosts({ perPage: 10, page: 1 });
const post = await wp.getPostBySlug('hello-world');
const me = await jwtClient.getCurrentUser();
```

## Use `request()` for unsupported endpoints

`request()` returns `{ data, response }`.

- `data` is parsed JSON when possible
- `response` is the native `fetch` response for status/header checks

```ts
const { data, response } = await wp.request({
  endpoint: '/posts',
  method: 'GET',
  params: { per_page: '5' },
});

if (!response.ok) {
  throw new Error(`Request failed: ${response.status}`);
}

console.log(data);
```

## Common unsupported use cases

### 1) Custom post type query (`/wp/v2/books`)

```ts
const { data, response } = await wp.request({
  endpoint: '/books',
  method: 'GET',
  params: { per_page: '20', status: 'publish' },
});

if (!response.ok) {
  throw new Error('Failed to fetch books');
}
```

### 2) Custom post type write (`POST /wp/v2/books`)

```ts
const { data, response } = await basicClient.request({
  endpoint: '/books',
  method: 'POST',
  body: {
    title: 'My Book',
    status: 'draft',
  },
});

if (!response.ok) {
  throw new Error('Failed to create book');
}
```

### 3) Custom taxonomy terms (`/wp/v2/genre`)

```ts
const { data, response } = await wp.request({
  endpoint: '/genre',
  method: 'GET',
  params: { per_page: '100' },
});

if (!response.ok) {
  throw new Error('Failed to fetch genre terms');
}
```

### 4) Plugin endpoint in another REST namespace

`request()` supports:

- v2-relative paths (example: `/posts`)
- full REST paths (example: `/wp-json/my-plugin/v1/sync`)
- same-origin absolute URLs

Call plugin endpoints by passing their full `/wp-json/...` path:

```ts
const { data, response } = await signedClient.request({
  endpoint: '/wp-json/my-plugin/v1/sync',
  method: 'POST',
  body: { mode: 'full' },
});

if (!response.ok) {
  throw new Error('Plugin sync failed');
}
```

## Practical guidance

- Use `getAll*()` for complete pagination (WordPress limits `per_page` to 100).
- Prefer `request()` for one-off endpoints and custom resources.
- Same-origin absolute URLs are supported when you already have a fully resolved endpoint.
- Cross-origin absolute URLs throw to prevent inherited auth or cookie headers from leaking to another host.
- Validate only the fields your feature truly requires, and leave the rest extensible for custom meta, ACF data, and plugin fields.
- Keep `authHeaders` pure and deterministic; it should only derive headers from request input.
- For Astro user-scoped flows, resolve auth per request in actions/middleware and pass JWT or signed headers from context.
