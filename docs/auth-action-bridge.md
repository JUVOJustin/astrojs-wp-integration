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
