# Auth Action Bridge

The package ships a JWT-first Astro auth bridge for WordPress.
It supports Astro `^5.0.0 || ^6.0.0`.

This bridge is a higher-level integration layer on top of `fluent-wp-client` transport primitives. New action or bridge behavior should follow established `WordPressClient` abilities and request helpers instead of inventing parallel request logic.

`WordPressClient` also supports browser-friendly cookie+nonce auth (`X-WP-Nonce` + `credentials: 'include'`) for front-end REST requests outside the JWT bridge flow.

It uses web-standard runtime APIs so the same bridge works in Node and non-Node Astro adapters.

## What It Provides

- `createWordPressAuthBridge(config)` to create a reusable auth bridge
- `wordPressLoginInputSchema` for strict login payload validation
- `loginAction` to exchange username/password for a WordPress JWT
- `resolveUser(context)` and `isAuthenticated(context)` for Astro middleware checks
- `getActionAuth(context)` to reuse the JWT in `create*PostAction` factories
- Re-exported client auth primitives like `createAuthResolver`, `jwtAuthTokenResponseSchema`, and `jwtAuthErrorResponseSchema` for custom auth flows

The bridge now relies on the published client's `loginWithJwt()` and `getCurrentUser()` helpers instead of duplicating request handling.

## Design Guidance

- Keep action factories generic so they can target core resources, custom post types, and plugin-backed endpoints that follow WordPress REST conventions.
- Validate only the minimum action input and response data required for the current feature, and leave room for custom fields, meta, and related plugin data.

## WordPress Requirement

Enable the [JWT Authentication for WP REST API](https://es.wordpress.org/plugins/jwt-authentication-for-wp-rest-api/) plugin and set a secret key in WordPress config:

```php
define('JWT_AUTH_SECRET_KEY', 'replace-with-a-long-random-secret');
```

## Input Validation

The login action validates:

- `usernameOrEmail`: non-empty string
- `password`: non-empty string
- `redirectTo`: optional local path

```typescript
import { z } from 'astro/zod';
import { wordPressLoginInputSchema } from 'wp-astrojs-integration';

type LoginPayload = z.input<typeof wordPressLoginInputSchema>;
```

## Setup

```typescript
// src/lib/auth/bridge.ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: 'https://your-wordpress-site.com',
  cookieName: 'wp_user_session',
  sessionDurationSeconds: 60 * 60 * 12,
});
```

```typescript
// src/actions/index.ts
import {
  createUpdatePostAction,
  createCreatePostAction,
  createDeletePostAction,
} from 'wp-astrojs-integration';
import { wordPressAuthBridge } from '../lib/auth/bridge';

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

If you need a custom auth integration (for example OAuth-style signatures), action factories also accept request-aware `authHeaders`.

```typescript
const signedActionsConfig = {
  baseUrl: import.meta.env.WP_URL,
  authHeaders: {
    fromContext: (context) => {
      const oauthToken = context.locals.oauthToken;

      // Return null when the current request has no auth context.
      // The action then fails with UNAUTHORIZED before calling WordPress.
      if (!oauthToken) {
        return null;
      }

      return ({ method, url, body }) => ({
        Authorization: createSignedAuthHeader({
          method,
          url: url.toString(),
          body,
          token: oauthToken,
        }),
      });
    },
  },
};
```

How `fromContext` works:

1. `fromContext(context)` runs once when the Astro action is invoked.
2. You read request-scoped values from Astro context (`locals`, cookies, session state).
3. You return a request signer function: `({ method, url, body }) => headers`.
4. The package calls that signer with the exact outgoing WordPress request data.
5. Your returned headers are sent with the WordPress request.

`createSignedAuthHeader` is your own application helper for custom auth integrations:

- It is not part of this package.
- It should build an `Authorization` header string from request data.
- It is not a sub-request by itself.

```typescript
type SignedHeaderInput = {
  method: string;
  url: string;
  body?: string;
  token: string;
};

function createSignedAuthHeader(input: SignedHeaderInput): string {
  // Replace with your real custom auth signature algorithm.
  return buildOAuthAuthorizationHeader(input);
}
```

## Middleware Example

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

## Protected Update Flow (Middleware + Action)

This flow reuses the same JWT cookie across middleware and actions:

1. Middleware checks authentication and sets `context.locals.user`.
2. `createUpdatePostAction` reads JWT auth from the same request cookie via `getActionAuth(context)`.
3. `Astro.callAction(actions.updatePost, ...)` automatically sends the correct `Authorization: Bearer ...` header to WordPress.

```astro
---
// src/pages/admin/edit-post.astro
import { actions } from 'astro:actions';

const user = Astro.locals.user;

if (!user) {
  return Astro.redirect('/login');
}

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData();
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') ?? '').trim();

  const { data, error } = await Astro.callAction(actions.updatePost, {
    id,
    title,
  });

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

## Testing

The auth bridge is exercised in the `integration` Vitest project and runs
against the real local `wp-env` WordPress instance.

Integration action tests use the shared Astro fixture at
`tests/fixtures/astro-site/`, which is booted by
`tests/setup/global-setup.ts` and exposed through real `/_actions/*` endpoints.

```bash
npm run wp:start
npm run test:integration
npm run wp:stop
```

Run `npm test` to execute both the integration project and the separate
`astro-build` project in one command.
