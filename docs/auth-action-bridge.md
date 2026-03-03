# Auth Action Bridge

The package ships a JWT-first Astro auth bridge for WordPress.

## What It Provides

- `createWordPressAuthBridge(config)` to create a reusable auth bridge
- `wordPressLoginInputSchema` for strict login payload validation
- `loginAction` to exchange username/password for a WordPress JWT
- `resolveUser(context)` and `isAuthenticated(context)` for Astro middleware checks
- `getActionAuth(context)` to reuse the JWT in `create*PostAction` factories

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

If you need non-JWT signing (for example OAuth-style signatures), action factories also accept request-aware `authHeaders`:

```typescript
const signedActionsConfig = {
  baseUrl: import.meta.env.WP_URL,
  authHeaders: {
    fromContext: (context) => ({ method, url, body }) => {
      const authorization = signWordPressRequest({
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
