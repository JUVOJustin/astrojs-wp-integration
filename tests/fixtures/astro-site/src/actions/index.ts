/**
 * Astro actions fixture wiring all package action factories for integration tests.
 *
 * Each action is configured with env-based auth so the test globalSetup
 * can inject credentials at runtime. The dev server resolves these through
 * `import.meta.env` which Vite populates from process.env.
 */
import { defineAction, type ActionAPIContext } from 'astro:actions';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
  createPostInputSchema,
  updatePostInputSchema,
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
  createTermInputSchema,
  updateTermInputSchema,
  createCreateUserAction,
  createUpdateUserAction,
  createDeleteUserAction,
  createUserInputSchema,
  updateUserInputSchema,
  createGetAbilityAction,
  createRunAbilityAction,
  createDeleteAbilityAction,
} from '../../../../../src/actions';
import { createWordPressAuthBridge } from '../../../../../src/server/auth';
import {
  WordPressClient,
  createAuthResolver,
  pageSchema,
  contentWordPressSchema,
  categorySchema,
} from 'fluent-wp-client';
import { z } from 'astro/zod';

const baseUrl = import.meta.env.WP_BASE_URL ?? 'http://localhost:8888';
const bridge = createWordPressAuthBridge({ baseUrl });
const staticBridge = createWordPressAuthBridge({
  baseUrl,
  auth: {
    username: 'admin',
    password: import.meta.env.WP_APP_PASSWORD ?? '',
  },
});
const staticInvalidAuthHeadersBridge = createWordPressAuthBridge({
  baseUrl,
  authHeaders: () => ({
    Authorization: `Basic ${btoa('admin:wrong-password')}`,
  }),
});
const requestHeaderBridge = createWordPressAuthBridge({
  baseUrl,
  authResolver: createAuthResolver<ActionAPIContext>((context) => {
    return context.request.headers.get('x-test-auth');
  }),
});
const staticJwtClient = new WordPressClient({
  baseUrl,
  auth: {
    token: import.meta.env.WP_JWT_TOKEN ?? '',
  },
});

const tokenInputSchema = z.object({ token: z.string().min(1) });

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

function createCookieReader(cookieName: string, token?: string): CookieReader {
  return {
    get: (name: string) => {
      if (!token || name !== cookieName) {
        return undefined;
      }

      return { value: token };
    },
  };
}

const requestClient = requestHeaderBridge.getClient;

/* ── Post actions ────────────────────────────────────── */

const createPost = createCreatePostAction(requestClient);

const createPostWithBridgeClient = createCreatePostAction(requestHeaderBridge.getClient);

const createPostCustomSchema = createCreatePostAction(requestClient, {
  schema: createPostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPostAcf = createCreatePostAction(requestClient, {
  schema: createPostInputSchema.extend({
    acf: z.object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    }).optional(),
  }),
});

const createPostResponseOverride = createCreatePostAction(requestClient, {
  responseSchema: z.object({
    id: z.number().int().positive(),
    status: z.string(),
  }),
});

const updatePost = createUpdatePostAction(requestClient);

const updatePostCustomSchema = createUpdatePostAction(requestClient, {
  schema: updatePostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const updatePostAcf = createUpdatePostAction(requestClient, {
  schema: updatePostInputSchema.extend({
    acf: z.object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    }).optional(),
  }),
});

const deletePost = createDeletePostAction(requestClient);

/* ── Page actions ────────────────────────────────────── */

const createPage = createCreatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: pageSchema,
});

const createPageWithStaticClient = createCreatePostAction(staticJwtClient, {
  resource: 'pages',
  responseSchema: pageSchema,
});

const updatePage = createUpdatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: pageSchema,
  schema: updatePostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPageResponseOverride = createCreatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: z.object({
    id: z.number().int().positive(),
    type: z.literal('page'),
    status: z.string(),
  }),
});

const deletePage = createDeletePostAction(requestClient, { resource: 'pages' });

/* ── Book (CPT) actions ──────────────────────────────── */

const createBook = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: contentWordPressSchema,
});

const createBookCustomSchema = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: contentWordPressSchema,
  schema: createPostInputSchema.extend({
    custom_note: z.string().min(3).optional(),
  }),
});

const createBookResponseOverride = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: z.object({
    id: z.number().int().positive(),
    type: z.literal('book'),
    status: z.string(),
  }),
});

const updateBook = createUpdatePostAction(requestClient, {
  resource: 'books',
  responseSchema: contentWordPressSchema,
  schema: updatePostInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const deleteBook = createDeletePostAction(requestClient, { resource: 'books' });

/* ── Term actions ────────────────────────────────────── */

const createCategory = createCreateTermAction(requestClient, {
  resource: 'categories',
  responseSchema: categorySchema,
  schema: createTermInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const updateCategory = createUpdateTermAction(requestClient, {
  resource: 'categories',
  responseSchema: categorySchema,
  schema: updateTermInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const deleteCategory = createDeleteTermAction(requestClient, { resource: 'categories' });

const createTag = createCreateTermAction(requestClient, {
  resource: 'tags',
  responseSchema: categorySchema,
});

const deleteTag = createDeleteTermAction(requestClient, { resource: 'tags' });

const createGenre = createCreateTermAction(requestClient, {
  resource: 'genres',
  responseSchema: z.object({
    id: z.number().int().positive(),
    taxonomy: z.literal('genre'),
    name: z.string(),
  }),
});

const deleteGenre = createDeleteTermAction(requestClient, { resource: 'genres' });

/* ── User actions ────────────────────────────────────── */

const createUser = createCreateUserAction(requestClient);

const createUserCustomSchema = createCreateUserAction(requestClient, {
  schema: createUserInputSchema.extend({
    app_source: z.string().optional(),
  }),
});

const createUserResponseOverride = createCreateUserAction(requestClient, {
  responseSchema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
  }),
});

const updateUser = createUpdateUserAction(requestClient);

const updateUserCustomSchema = createUpdateUserAction(requestClient, {
  schema: updateUserInputSchema.extend({
    app_updated_by: z.string().optional(),
  }),
});

const deleteUser = createDeleteUserAction(requestClient);

/* ── Ability actions ─────────────────────────────────── */

const getAbility = createGetAbilityAction(requestClient, {
  responseSchema: z.object({ title: z.string().min(1) }),
});

const getAbilityWithBridgeClient = createGetAbilityAction(requestHeaderBridge.getClient, {
  responseSchema: z.object({ title: z.string().min(1) }),
});

const runAbility = createRunAbilityAction(requestClient, {
  responseSchema: z.object({ current: z.string().min(1) }),
});

const deleteAbility = createDeleteAbilityAction(requestClient, {
  responseSchema: z.object({ deleted: z.boolean() }),
});

/* ── Auth bridge actions ─────────────────────────────── */

const authBridgeGetSession = defineAction({
  input: tokenInputSchema,
  handler: ({ token }) => {
    const session = bridge.getSession(token);

    if (!session) {
      return null;
    }

    return {
      token: session.token,
      authHeader: session.authHeader,
    };
  },
});

const authBridgeGetSessionWithoutBuffer = defineAction({
  input: tokenInputSchema,
  handler: ({ token }) => {
    const originalBuffer = (globalThis as { Buffer?: unknown }).Buffer;
    Reflect.set(globalThis as object, 'Buffer', undefined);

    try {
      const session = bridge.getSession(token);

      if (!session) {
        return null;
      }

      return {
        token: session.token,
      };
    } finally {
      Reflect.set(globalThis as object, 'Buffer', originalBuffer);
    }
  },
});

const authBridgeResolveUserBySessionId = defineAction({
  input: tokenInputSchema,
  handler: async ({ token }) => {
    const user = await bridge.resolveUserBySessionId(token);

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
});

const authBridgeResolveUserBySessionIdUnreachable = defineAction({
  input: tokenInputSchema,
  handler: async ({ token }) => {
    const unreachableBridge = createWordPressAuthBridge({ baseUrl: 'http://127.0.0.1:9' });
    return unreachableBridge.resolveUserBySessionId(token);
  },
});

const authBridgeResolveUser = defineAction({
  input: tokenInputSchema,
  handler: async ({ token }) => {
    const user = await bridge.resolveUser({
      cookies: createCookieReader(bridge.cookieName, token) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    });

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
});

const authBridgeResolveUserIgnoringStaticFallback = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => {
    const user = await staticBridge.resolveUser({
      cookies: createCookieReader(staticBridge.cookieName, token) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    });

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
});

const authBridgeResolveUserWithOptInStaticFallback = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => {
    const client = await staticBridge.getClient({
      cookies: createCookieReader(staticBridge.cookieName, token) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    }, {
      allowStaticAuthFallback: true,
    });

    if (!client) {
      return null;
    }

    const user = await client.getCurrentUser();

    return {
      slug: user.slug,
    };
  },
});

const authBridgeRespectsPerCallAuthHeaders = defineAction({
  handler: async () => {
    const client = await staticInvalidAuthHeadersBridge.getClient({
      cookies: createCookieReader(staticInvalidAuthHeadersBridge.cookieName) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    }, {
      allowStaticAuthFallback: true,
      authHeaders: () => ({
        Authorization: `Basic ${btoa(`admin:${import.meta.env.WP_APP_PASSWORD ?? ''}`)}`,
      }),
    });

    if (!client) {
      return null;
    }

    const user = await client.getCurrentUser();

    return {
      slug: user.slug,
    };
  },
});

const authBridgeIsAuthenticated = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => bridge.isAuthenticated({
    cookies: createCookieReader(bridge.cookieName, token) as ActionAPIContext['cookies'],
    request: new Request('http://localhost'),
  }),
});

export const server = {
  createPost,
  createPostWithBridgeClient,
  createPostCustomSchema,
  createPostAcf,
  createPostResponseOverride,
  updatePost,
  updatePostCustomSchema,
  updatePostAcf,
  deletePost,

  createPage,
  createPageWithStaticClient,
  updatePage,
  createPageResponseOverride,
  deletePage,

  createBook,
  createBookCustomSchema,
  createBookResponseOverride,
  updateBook,
  deleteBook,

  createCategory,
  updateCategory,
  deleteCategory,
  createTag,
  deleteTag,
  createGenre,
  deleteGenre,

  createUser,
  createUserCustomSchema,
  createUserResponseOverride,
  updateUser,
  updateUserCustomSchema,
  deleteUser,

  getAbility,
  getAbilityWithBridgeClient,
  runAbility,
  deleteAbility,

  authBridgeGetSession,
  authBridgeGetSessionWithoutBuffer,
  authBridgeResolveUserBySessionId,
  authBridgeResolveUserBySessionIdUnreachable,
  authBridgeResolveUser,
  authBridgeResolveUserIgnoringStaticFallback,
  authBridgeResolveUserWithOptInStaticFallback,
  authBridgeRespectsPerCallAuthHeaders,
  authBridgeIsAuthenticated,
};
