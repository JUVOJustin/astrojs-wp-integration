/**
 * Astro actions fixture wiring all package action factories for integration tests.
 *
 * Each action is configured with env-based auth so the test globalSetup
 * can inject credentials at runtime. The dev server resolves these through
 * `import.meta.env` which Vite populates from process.env.
 */
import { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext } from 'astro:actions';
import {
  categorySchema,
  createAuthResolver,
  WordPressClient,
} from 'fluent-wp-client';

import {
  createCreatePostAction,
  createCreateTermAction,
  createCreateUserAction,
  createDeleteAbilityAction,
  createDeletePostAction,
  createDeleteTermAction,
  createDeleteUserAction,
  createGetAbilityAction,
  createPostInputSchema,
  createRunAbilityAction,
  createUpdatePostAction,
  createUpdateTermAction,
  createUpdateUserAction,
  createUserInputSchema,
  createWpCacheInvalidateAction,
  updatePostInputSchema,
  updateTermInputSchema,
  updateUserInputSchema,
} from '../../../../../src/actions';
import { createWordPressAuthBridge } from '../../../../../src/server/auth';
import {
  booksCreateSchema,
  booksUpdateSchema,
  categoriesCreateSchema,
  postsCreateSchema,
  postsUpdateSchema,
} from '../action-schemas';
import {
  booksItemSchema,
  categoriesItemSchema,
  pagesItemSchema,
  postsItemSchema,
} from '../generated/wp-schemas';
import { createAcfChoiceLabelMapper } from '../lib/acf-choice-label-mapper';
import {
  getRouteCacheMetrics,
  resetRouteCacheMetrics,
} from '../lib/wp-fetch-metrics';

const baseUrl = import.meta.env.WP_BASE_URL ?? 'http://localhost:8888';
const bridge = createWordPressAuthBridge({ baseUrl });

const staticBridge = createWordPressAuthBridge({
  auth: {
    password: import.meta.env.WP_APP_PASSWORD ?? '',
    username: 'admin',
  },
  baseUrl,
});

const staticInvalidAuthHeadersBridge = createWordPressAuthBridge({
  authHeaders: () => ({
    Authorization: `Basic ${btoa('admin:wrong-password')}`,
  }),
  baseUrl,
});

const requestHeaderBridge = createWordPressAuthBridge({
  authResolver: createAuthResolver<ActionAPIContext>((context) =>
    context.request.headers.get('x-test-auth')
  ),
  baseUrl,
});

const staticJwtClient = new WordPressClient({
  auth: {
    token: import.meta.env.WP_JWT_TOKEN ?? '',
  },
  baseUrl,
});

const tokenInputSchema = z.object({ token: z.string().min(1) });

interface CookieReader {
  get: (name: string) => { value: string } | undefined;
}

function createCookieReader(cookieName: string, token?: string): CookieReader {
  return {
    get: (name: string) => {
      if (!token || name !== cookieName) {
        return;
      }

      return { value: token };
    },
  };
}

const requestClient = requestHeaderBridge.getClient;
const mapAcfChoiceLabels = createAcfChoiceLabelMapper(baseUrl);

/* ── Post actions ────────────────────────────────────── */

const createPost = createCreatePostAction(requestClient);

const createPostWithBridgeClient = createCreatePostAction(
  requestHeaderBridge.getClient
);

const createPostCustomSchema = createCreatePostAction(requestClient, {
  schema: postsCreateSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPostAcf = createCreatePostAction(requestClient, {
  schema: createPostInputSchema.extend({
    acf: z
      .object({
        acf_priority_score: z.number().int().min(0).max(100).optional(),
        acf_project_status: z.string().optional(),
        acf_subtitle: z.string().optional(),
      })
      .optional(),
  }),
});

const createPostAcfMapped = createCreatePostAction(requestClient, {
  mapResponse: mapAcfChoiceLabels,
  schema: createPostInputSchema.extend({
    acf: z
      .object({
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
});

const createPostResponseOverride = createCreatePostAction(requestClient, {
  responseSchema: postsItemSchema.pick({
    id: true,
    status: true,
  }),
  schema: postsCreateSchema,
});

const updatePost = createUpdatePostAction(requestClient);

const updatePostCustomSchema = createUpdatePostAction(requestClient, {
  schema: postsUpdateSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const updatePostAcf = createUpdatePostAction(requestClient, {
  schema: updatePostInputSchema.extend({
    acf: z
      .object({
        acf_priority_score: z.number().int().min(0).max(100).optional(),
        acf_project_status: z.string().optional(),
        acf_subtitle: z.string().optional(),
      })
      .optional(),
  }),
});

const updatePostAcfMapped = createUpdatePostAction(requestClient, {
  mapResponse: mapAcfChoiceLabels,
  schema: updatePostInputSchema.extend({
    acf: z
      .object({
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
});

const deletePost = createDeletePostAction(requestClient);

/* ── Page actions ────────────────────────────────────── */

const createPage = createCreatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: pagesItemSchema,
});

const createPageWithStaticClient = createCreatePostAction(staticJwtClient, {
  resource: 'pages',
  responseSchema: pagesItemSchema,
});

const updatePage = createUpdatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: pagesItemSchema,
  schema: updatePostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPageResponseOverride = createCreatePostAction(requestClient, {
  resource: 'pages',
  responseSchema: z.object({
    id: z.number().int().positive(),
    status: z.string(),
    type: z.literal('page'),
  }),
});

const deletePage = createDeletePostAction(requestClient, { resource: 'pages' });

/* ── Book (CPT) actions ──────────────────────────────── */

const createBook = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: booksItemSchema,
  schema: booksCreateSchema,
});

const createBookCustomSchema = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: booksItemSchema,
  schema: booksCreateSchema,
});

const createBookResponseOverride = createCreatePostAction(requestClient, {
  resource: 'books',
  responseSchema: z.object({
    id: z.number().int().positive(),
    status: z.string(),
    type: z.literal('book'),
  }),
});

const updateBook = createUpdatePostAction(requestClient, {
  resource: 'books',
  responseSchema: booksItemSchema,
  schema: booksUpdateSchema,
});

const deleteBook = createDeletePostAction(requestClient, { resource: 'books' });

/* ── Term actions ────────────────────────────────────── */

const createCategory = createCreateTermAction(requestClient, {
  resource: 'categories',
  responseSchema: categoriesItemSchema,
  schema: categoriesCreateSchema.extend({
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

const deleteCategory = createDeleteTermAction(requestClient, {
  resource: 'categories',
});

const createTag = createCreateTermAction(requestClient, {
  resource: 'tags',
  responseSchema: categorySchema,
});

const deleteTag = createDeleteTermAction(requestClient, { resource: 'tags' });

const createGenre = createCreateTermAction(requestClient, {
  resource: 'genres',
  responseSchema: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    taxonomy: z.literal('genre'),
  }),
});

const deleteGenre = createDeleteTermAction(requestClient, {
  resource: 'genres',
});

const wpCacheInvalidate = createWpCacheInvalidateAction(requestClient);

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

const getAbilityWithBridgeClient = createGetAbilityAction(
  requestHeaderBridge.getClient,
  {
    responseSchema: z.object({ title: z.string().min(1) }),
  }
);

const runAbility = createRunAbilityAction(requestClient, {
  responseSchema: z.object({ current: z.string().min(1) }),
});

const deleteAbility = createDeleteAbilityAction(requestClient, {
  responseSchema: z.object({ deleted: z.boolean() }),
});

/* ── Auth bridge actions ─────────────────────────────── */

const authBridgeGetSession = defineAction({
  handler: ({ token }) => {
    const session = bridge.getSession(token);

    if (!session) {
      return null;
    }

    return {
      authHeader: session.authHeader,
      token: session.token,
    };
  },
  input: tokenInputSchema,
});

const authBridgeGetSessionWithoutBuffer = defineAction({
  handler: ({ token }) => {
    const originalBuffer = globalThis.Buffer;
    Reflect.set(globalThis, 'Buffer', undefined);

    try {
      const session = bridge.getSession(token);

      if (!session) {
        return null;
      }

      return {
        token: session.token,
      };
    } finally {
      Reflect.set(globalThis, 'Buffer', originalBuffer);
    }
  },
  input: tokenInputSchema,
});

const authBridgeResolveUserBySessionId = defineAction({
  handler: async ({ token }) => {
    const user = await bridge.resolveUserBySessionId(token);

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
  input: tokenInputSchema,
});

const authBridgeResolveUserBySessionIdUnreachable = defineAction({
  handler: async ({ token }) => {
    const unreachableBridge = createWordPressAuthBridge({
      baseUrl: 'http://127.0.0.1:9',
    });

    return unreachableBridge.resolveUserBySessionId(token);
  },
  input: tokenInputSchema,
});

const authBridgeResolveUser = defineAction({
  handler: async ({ token }) => {
    const user = await bridge.resolveUser({
      // SAFETY: These auth probes only read cookies; the fake reader intentionally omits Astro cookie mutations.
      cookies: createCookieReader(
        bridge.cookieName,
        token
      ) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    });

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
  input: tokenInputSchema,
});

const authBridgeResolveUserIgnoringStaticFallback = defineAction({
  handler: async ({ token }) => {
    const user = await staticBridge.resolveUser({
      // SAFETY: These auth probes only read cookies; the fake reader intentionally omits Astro cookie mutations.
      cookies: createCookieReader(
        staticBridge.cookieName,
        token
      ) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    });

    if (!user) {
      return null;
    }

    return {
      slug: user.slug,
    };
  },
  input: z.object({ token: z.string().optional() }),
});

const authBridgeResolveUserWithOptInStaticFallback = defineAction({
  handler: async ({ token }) => {
    const client = await staticBridge.getClient(
      {
        // SAFETY: These auth probes only read cookies; the fake reader intentionally omits Astro cookie mutations.
        cookies: createCookieReader(
          staticBridge.cookieName,
          token
        ) as ActionAPIContext['cookies'],
        request: new Request('http://localhost'),
      },
      {
        allowStaticAuthFallback: true,
      }
    );

    if (!client) {
      return null;
    }

    const user = await client.users().me();

    return {
      slug: user.slug,
    };
  },
  input: z.object({ token: z.string().optional() }),
});

const authBridgeRespectsPerCallAuthHeaders = defineAction({
  handler: async () => {
    const client = await staticInvalidAuthHeadersBridge.getClient(
      {
        // SAFETY: These auth probes only read cookies; the fake reader intentionally omits Astro cookie mutations.
        cookies: createCookieReader(
          staticInvalidAuthHeadersBridge.cookieName
        ) as ActionAPIContext['cookies'],
        request: new Request('http://localhost'),
      },
      {
        allowStaticAuthFallback: true,
        authHeaders: () => ({
          Authorization: `Basic ${btoa(`admin:${import.meta.env.WP_APP_PASSWORD ?? ''}`)}`,
        }),
      }
    );

    if (!client) {
      return null;
    }

    const user = await client.users().me();

    return {
      slug: user.slug,
    };
  },
});

const authBridgeIsAuthenticated = defineAction({
  handler: async ({ token }) =>
    bridge.isAuthenticated({
      // SAFETY: These auth probes only read cookies; the fake reader intentionally omits Astro cookie mutations.
      cookies: createCookieReader(
        bridge.cookieName,
        token
      ) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    }),
  input: z.object({ token: z.string().optional() }),
});

const getCurrentUserProfile = defineAction({
  handler: async (_input, context) => {
    const client = await requestClient(context);
    const user = await client.users().me();

    return {
      email: user.email,
      id: user.id,
      name: user.name,
      slug: user.slug,
    };
  },
});

const emptyObjectSchema = z.object({});

const routeCacheMetricsGet = defineAction({
  handler: () => getRouteCacheMetrics(),
  input: emptyObjectSchema,
});

const routeCacheMetricsReset = defineAction({
  handler: () => resetRouteCacheMetrics(),
  input: emptyObjectSchema,
});

export const server = {
  authBridgeGetSession,
  authBridgeGetSessionWithoutBuffer,
  authBridgeIsAuthenticated,
  authBridgeResolveUser,
  authBridgeResolveUserBySessionId,
  authBridgeResolveUserBySessionIdUnreachable,
  authBridgeResolveUserIgnoringStaticFallback,
  authBridgeResolveUserWithOptInStaticFallback,
  authBridgeRespectsPerCallAuthHeaders,
  createBook,
  createBookCustomSchema,
  createBookResponseOverride,
  createCategory,
  createGenre,
  createPage,
  createPageResponseOverride,
  createPageWithStaticClient,
  createPost,
  createPostAcf,
  createPostAcfMapped,
  createPostCustomSchema,
  createPostResponseOverride,
  createPostWithBridgeClient,
  createTag,
  createUser,
  createUserCustomSchema,
  createUserResponseOverride,
  deleteAbility,
  deleteBook,
  deleteCategory,
  deleteGenre,
  deletePage,
  deletePost,
  deleteTag,
  deleteUser,
  getAbility,
  getAbilityWithBridgeClient,
  getCurrentUserProfile,
  routeCacheMetricsGet,
  routeCacheMetricsReset,
  runAbility,
  updateBook,
  updateCategory,
  updatePage,
  updatePost,
  updatePostAcf,
  updatePostAcfMapped,
  updatePostCustomSchema,
  updateUser,
  updateUserCustomSchema,
  wpCacheInvalidate,
};
