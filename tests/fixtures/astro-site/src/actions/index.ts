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
  pageSchema,
  contentWordPressSchema,
  categorySchema,
} from 'fluent-wp-client';
import { z } from 'astro/zod';

const baseUrl = import.meta.env.WP_BASE_URL ?? 'http://localhost:8888';
const bridge = createWordPressAuthBridge({ baseUrl });

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

/**
 * Auth resolver that reads the JWT token from the X-Test-Auth request header.
 * Tests pass the JWT token via this header so the action handler can
 * authenticate against WordPress on behalf of the test.
 */
const testAuth = {
  fromContext: (context: { request: Request }) => {
    const header = context.request.headers.get('x-test-auth');
    if (!header) return null;
    return { Authorization: header };
  },
};

/** Auth config that reads JWT from X-Test-Auth header. */
const jwtAuthConfig = { authHeaders: testAuth };

/** Auth config that reads basic auth from X-Test-Auth header. */
const basicAuthConfig = { authHeaders: testAuth };

/* ── Post actions ────────────────────────────────────── */

const createPost = createCreatePostAction({
  baseUrl,
  ...jwtAuthConfig,
});

const createPostCustomSchema = createCreatePostAction({
  baseUrl,
  ...jwtAuthConfig,
  schema: createPostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPostAcf = createCreatePostAction({
  baseUrl,
  ...jwtAuthConfig,
  schema: createPostInputSchema.extend({
    acf: z.object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    }).optional(),
  }),
});

const createPostResponseOverride = createCreatePostAction({
  baseUrl,
  ...jwtAuthConfig,
  responseSchema: z.object({
    id: z.number().int().positive(),
    status: z.string(),
  }),
});

const updatePost = createUpdatePostAction({
  baseUrl,
  ...jwtAuthConfig,
});

const updatePostCustomSchema = createUpdatePostAction({
  baseUrl,
  ...jwtAuthConfig,
  schema: updatePostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const updatePostAcf = createUpdatePostAction({
  baseUrl,
  ...jwtAuthConfig,
  schema: updatePostInputSchema.extend({
    acf: z.object({
      acf_subtitle: z.string().optional(),
      acf_priority_score: z.number().int().min(0).max(100).optional(),
    }).optional(),
  }),
});

const deletePost = createDeletePostAction({
  baseUrl,
  ...jwtAuthConfig,
});

/* ── Page actions ────────────────────────────────────── */

const createPage = createCreatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'pages',
  responseSchema: pageSchema,
});

const updatePage = createUpdatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'pages',
  responseSchema: pageSchema,
  schema: updatePostInputSchema.extend({
    acf: z.object({ acf_subtitle: z.string().optional() }).optional(),
  }),
});

const createPageResponseOverride = createCreatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'pages',
  responseSchema: z.object({
    id: z.number().int().positive(),
    type: z.literal('page'),
    status: z.string(),
  }),
});

const deletePage = createDeletePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'pages',
});

/* ── Book (CPT) actions ──────────────────────────────── */

const createBook = createCreatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'books',
  responseSchema: contentWordPressSchema,
});

const createBookCustomSchema = createCreatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'books',
  responseSchema: contentWordPressSchema,
  schema: createPostInputSchema.extend({
    custom_note: z.string().min(3).optional(),
  }),
});

const createBookResponseOverride = createCreatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'books',
  responseSchema: z.object({
    id: z.number().int().positive(),
    type: z.literal('book'),
    status: z.string(),
  }),
});

const updateBook = createUpdatePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'books',
  responseSchema: contentWordPressSchema,
  schema: updatePostInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const deleteBook = createDeletePostAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'books',
});

/* ── Term actions ────────────────────────────────────── */

const createCategory = createCreateTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'categories',
  responseSchema: categorySchema,
  schema: createTermInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const updateCategory = createUpdateTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'categories',
  responseSchema: categorySchema,
  schema: updateTermInputSchema.extend({
    custom_note: z.string().optional(),
  }),
});

const deleteCategory = createDeleteTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'categories',
});

const createTag = createCreateTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'tags',
  responseSchema: categorySchema,
});

const deleteTag = createDeleteTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'tags',
});

const createGenre = createCreateTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'genres',
  responseSchema: z.object({
    id: z.number().int().positive(),
    taxonomy: z.literal('genre'),
    name: z.string(),
  }),
});

const deleteGenre = createDeleteTermAction({
  baseUrl,
  ...basicAuthConfig,
  resource: 'genres',
});

/* ── User actions ────────────────────────────────────── */

const createUser = createCreateUserAction({
  baseUrl,
  ...basicAuthConfig,
});

const createUserCustomSchema = createCreateUserAction({
  baseUrl,
  ...basicAuthConfig,
  schema: createUserInputSchema.extend({
    app_source: z.string().optional(),
  }),
});

const createUserResponseOverride = createCreateUserAction({
  baseUrl,
  ...basicAuthConfig,
  responseSchema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
  }),
});

const updateUser = createUpdateUserAction({
  baseUrl,
  ...basicAuthConfig,
});

const updateUserCustomSchema = createUpdateUserAction({
  baseUrl,
  ...basicAuthConfig,
  schema: updateUserInputSchema.extend({
    app_updated_by: z.string().optional(),
  }),
});

const deleteUser = createDeleteUserAction({
  baseUrl,
  ...basicAuthConfig,
});

/* ── Ability actions ─────────────────────────────────── */

const getAbility = createGetAbilityAction({
  baseUrl,
  ...basicAuthConfig,
  responseSchema: z.object({ title: z.string().min(1) }),
});

const runAbility = createRunAbilityAction({
  baseUrl,
  ...basicAuthConfig,
  responseSchema: z.object({ current: z.string().min(1) }),
});

const deleteAbility = createDeleteAbilityAction({
  baseUrl,
  ...basicAuthConfig,
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

const authBridgeGetActionAuth = defineAction({
  input: tokenInputSchema,
  handler: async ({ token }) => {
    const auth = await bridge.getActionAuth({
      cookies: createCookieReader(bridge.cookieName, token) as ActionAPIContext['cookies'],
      request: new Request('http://localhost'),
    });

    if (!auth) {
      return null;
    }

    return {
      token: auth.token,
    };
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

const authBridgeIsAuthenticated = defineAction({
  input: z.object({ token: z.string().optional() }),
  handler: async ({ token }) => bridge.isAuthenticated({
    cookies: createCookieReader(bridge.cookieName, token) as ActionAPIContext['cookies'],
    request: new Request('http://localhost'),
  }),
});

export const server = {
  createPost,
  createPostCustomSchema,
  createPostAcf,
  createPostResponseOverride,
  updatePost,
  updatePostCustomSchema,
  updatePostAcf,
  deletePost,

  createPage,
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
  runAbility,
  deleteAbility,

  authBridgeGetSession,
  authBridgeGetSessionWithoutBuffer,
  authBridgeResolveUserBySessionId,
  authBridgeResolveUserBySessionIdUnreachable,
  authBridgeGetActionAuth,
  authBridgeResolveUser,
  authBridgeIsAuthenticated,
};
