import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import {
  postWriteBaseSchema,
  type WordPressPost,
  type WordPressStandardSchema,
} from 'fluent-wp-client/zod';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from './client';
import { getDefaultContentResponseSchema } from './response-schema';

/**
 * Input schema for creating a new WordPress post (or page / custom post type).
 *
 * Identical to `updatePostInputSchema` minus the `id` field — WordPress
 * assigns the ID on creation.  All fields are optional; WordPress applies
 * sensible defaults (e.g. status defaults to 'draft').
 *
 * Extend to add custom fields such as ACF data:
 * @example
 * const mySchema = createPostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 */
export const createPostInputSchema = postWriteBaseSchema;

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

/**
 * Low-level config accepted by `executeCreatePost`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'posts',
 * 'pages', 'books').  The optional `responseSchema` overrides the default
 * `postSchema` so the response can be parsed as a different type.
 */
export interface ExecuteCreateConfig<T = WordPressPost> extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: postSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the create-post action factory.
 * At least one auth strategy is required because creating posts needs write access.
 */
export interface CreatePostActionConfig<T = WordPressPost> {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Creates a new WordPress post (or page / CPT) via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `config.responseSchema` to parse the response with a
 * matching Standard Schema-compatible validator.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeCreatePost<T = WordPressPost>(
  config: ExecuteCreateConfig<T>,
  input: CreatePostInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'posts';

  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? getDefaultContentResponseSchema(resource)) as WordPressStandardSchema<T>;

    return client.createContent<T, CreatePostInput & Record<string, unknown>>(
      resource,
      input,
      responseSchema,
    );
  });
}

/**
 * Creates a predefined Astro server action that creates a new WordPress post
 * (or page / CPT) via the REST API.  All provided fields are forwarded to
 * WordPress, and any error is surfaced as an `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'pages'`).
 * Pass a custom `schema` (via `createPostInputSchema.extend(...)`) for
 * typed custom fields such as ACF data.
 *
 * @example
 * // Basic usage (posts)
 * export const server = {
 *   createPost: createCreatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // Pages
 * export const server = {
 *   createPage: createCreatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *     resource: 'pages',
 *   }),
 * };
 */
export function createCreatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof createPostInputSchema = typeof createPostInputSchema
>(config: CreatePostActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createPostInputSchema) as TSchema;
  const resource = config.resource;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeCreatePost<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, resource, responseSchema },
        input as CreatePostInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
