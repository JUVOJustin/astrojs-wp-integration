# auth-action-bridge.md

The package ships a ready-to-use Astro server action bridge for WordPress authentication.

## What It Provides

- `createWordPressAuthBridge(config)` to create a full auth bridge
- `wordPressLoginInputSchema` for strict Zod validation
- `loginAction` for Astro Actions form submissions
- in-memory session helpers for middleware and logout
- cookie writing on successful login (HTTP-only)

## Input Validation

The login action uses a predefined Zod schema:

- `identifier`: username or email string
- `email`: username or email string (backward-compatible alias)
- `username`: username or email string (backward-compatible alias)
- `password`: non-empty string (max 512 chars)
- `redirectTo`: optional local path

Input is validated before any WordPress request is executed.

```typescript
import { z } from 'astro/zod';
import { wordPressLoginInputSchema } from 'wp-astrojs-integration';

type LoginPayload = z.input<typeof wordPressLoginInputSchema>;
```

## Example Setup

```typescript
// src/lib/auth/bridge.ts
import { createWordPressAuthBridge } from 'wp-astrojs-integration';

export const wordPressAuthBridge = createWordPressAuthBridge({
  baseUrl: 'https://app.collabfinder.org',
  cookieName: 'collabfinder_session',
  sessionDurationSeconds: 60 * 60 * 12,
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
import { isInputError } from 'astro:actions';
import { server } from '../actions';

const result = Astro.getActionResult(server.login);

if (result && !result.error) {
  return Astro.redirect(result.data.redirectTo);
}

const inputErrors = isInputError(result?.error) ? result.error.fields : {};
---

<form method="POST" action={server.login}>
  <input type="hidden" name="redirectTo" value="/" />
  <input type="text" name="identifier" autocomplete="username" required />
  <input type="password" name="password" autocomplete="current-password" required />
  <button type="submit">Sign in</button>
</form>

{inputErrors.identifier && <p>{inputErrors.identifier.join(', ')}</p>}
```

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { wordPressAuthBridge } from './lib/auth/bridge';

export const onRequest = defineMiddleware(async (context, next) => {
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
