/**
 * Astro actions fixture wiring all package action factories for integration tests.
 *
 * Each action is configured with env-based auth so the test globalSetup
 * can inject credentials at runtime. The dev server resolves these through
 * `import.meta.env` which Vite populates from process.env.
 */
import { type ActionAPIContext, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import {
  categorySchema,
  contentWordPressSchema,
  createAuthResolver,
  pageSchema,
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
  createTermInputSchema,
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
  booksItemSchema,
  booksUpdateSchema,
  categoriesCreateSchema,
  categoriesItemSchema,
  pagesItemSchema,
  postsCreateSchema,
  postsItemSchema,
  postsUpdateSchema,
} from '../generated/wp-schemas';
import { createAcfChoiceLabelMapper } from '../lib/acf-choice-label-mapper';
import {
  getRouteCacheMetrics,
  resetRouteCacheMetrics,
} from '../lib/wp-fetch-metrics';

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
const mapAcfChoiceLabels = createAcfChoiceLabelMapper(baseUrl);

/* ── Post actions ────────────────────────────────────── */

const createPost = createCreatePostAction(requestClient);

const createPostWithBridgeClient = createCreatePostAction(
  requestHeaderBridge.getClient,
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
        acf_subtitle: z.string().optional(),
        acf_priority_score: z.number().int().min(0).max(100).optional(),
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
});

const createPostAcfMapped = createCreatePostAction(requestClient, {
  schema: createPostInputSchema.extend({
    acf: z
      .object({
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
  mapResponse: mapAcfChoiceLabels,
});

const createPostResponseOverride = createCreatePostAction(requestClient, {
  schema: postsCreateSchema,
  responseSchema: postsItemSchema.pick({
    id: true,
    status: true,
  }),
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
        acf_subtitle: z.string().optional(),
        acf_priority_score: z.number().int().min(0).max(100).optional(),
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
});

const updatePostAcfMapped = createUpdatePostAction(requestClient, {
  schema: updatePostInputSchema.extend({
    acf: z
      .object({
        acf_project_status: z.string().optional(),
      })
      .optional(),
  }),
  mapResponse: mapAcfChoiceLabels,
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
    type: z.literal('page'),
    status: z.string(),
  }),
});

const deletePage = createDeletePostAction(requestClient, { resource: 'pages' });

/* ── Book (CPT) actions ──────────────────────────────── */

const createBook = createCreatePostAction(requestClient, {
  resource: 'books',
  schema: booksCreateSchema,
  responseSchema: booksItemSchema,
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
    type: z.literal('book'),
    status: z.string(),
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
    taxonomy: z.literal('genre'),
    name: z.string(),
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
  },
);

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
    const unreachableBridge = createWordPressAuthBridge({
      baseUrl: 'http://127.0.0.1:9',
    });
    return unreachableBridge.resolveUserBySessionId(token);
  },
});

const authBridgeResolveUser = defineAction({
  input: tokenInputSchema,
  handler: async ({ token }) => {
    const user = await bridge.resolveUser({
      cookies: createCookieReader(
        bridge.cookieName,
        token,
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
});

const authBridgeResolveUserIgnoringStaticFallback = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => {
    const user = await staticBridge.resolveUser({
      cookies: createCookieReader(
        staticBridge.cookieName,
        token,
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
});

const authBridgeResolveUserWithOptInStaticFallback = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => {
    const client = await staticBridge.getClient(
      {
        cookies: createCookieReader(
          staticBridge.cookieName,
          token,
        ) as ActionAPIContext['cookies'],
        request: new Request('http://localhost'),
      },
      {
        allowStaticAuthFallback: true,
      },
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

const authBridgeRespectsPerCallAuthHeaders = defineAction({
  handler: async () => {
    const client = await staticInvalidAuthHeadersBridge.getClient(
      {
        cookies: createCookieReader(
          staticInvalidAuthHeadersBridge.cookieName,
        ) as ActionAPIContext['cookies'],
        request: new Request('http://localhost'),
      },
      {
        allowStaticAuthFallback: true,
        authHeaders: () => ({
          Authorization: `Basic ${btoa(`admin:${import.meta.env.WP_APP_PASSWORD ?? ''}`)}`,
        }),
      },
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
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) =>
    bridge.isAuthenticated({
      cookies: createCookieReader(
        bridge.cookieName,
        token,
      ) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    }),
});

const emptyObjectSchema = z.object({});

const routeCacheMetricsGet = defineAction({
  input: emptyObjectSchema,
  handler: () => getRouteCacheMetrics(),
});

const routeCacheMetricsReset = defineAction({
  input: emptyObjectSchema,
  handler: () => resetRouteCacheMetrics(),
});

export const server = {
  createPost,
  createPostWithBridgeClient,
  createPostCustomSchema,
  createPostAcf,
  createPostAcfMapped,
  createPostResponseOverride,
  updatePost,
  updatePostCustomSchema,
  updatePostAcf,
  updatePostAcfMapped,
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
  wpCacheInvalidate,

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
  routeCacheMetricsGet,
  routeCacheMetricsReset,
};
