import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import {
  postWriteBaseSchema,
  type WordPressPost,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from './client';
import { getDefaultContentResponseSchema } from './response-schema';

/**
 * Full input schema for updating an existing WordPress post (or page / CPT).
 *
 * Extends `postWriteBaseSchema` (the shared writable fields used by both
 * create and update) with the required `id` field.
 *
 * Extend this schema to add custom fields such as ACF data:
 * @example
 * const mySchema = updatePostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 */
export const updatePostInputSchema = postWriteBaseSchema.extend({
  id: z.number().int().positive(),
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

/**
 * Low-level config accepted by `executeUpdatePost`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'posts',
 * 'pages', 'books').  The optional `responseSchema` overrides the default
 * `postSchema` so the response can be parsed as a different type.
 */
export interface ExecuteUpdateConfig<T = WordPressPost> extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: postSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the update-post action factory.
 * At least one auth strategy is required because editing posts needs write access.
 */
export interface UpdatePostActionConfig<T = WordPressPost> {
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
 * Updates an existing WordPress post (or page / CPT) via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `config.responseSchema` to parse the response with a
 * matching Standard Schema-compatible validator.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeUpdatePost<T = WordPressPost>(
  config: ExecuteUpdateConfig<T>,
  input: UpdatePostInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'posts';

  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? getDefaultContentResponseSchema(resource)) as WordPressStandardSchema<T>;
    const { id, ...fields } = input;

    return client.updateContent<T, Record<string, unknown>>(
      resource,
      id,
      fields,
      responseSchema,
    );
  });
}

/**
 * Creates a predefined Astro server action that updates a WordPress post
 * (or page / CPT) via the REST API.  All provided fields are passed through
 * to WordPress, and any error returned by WordPress is surfaced as an
 * `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'pages'`).
 * Pass a custom `schema` (via `updatePostInputSchema.extend(...)`) to
 * include extra fields such as ACF data or other custom plugin fields.
 *
 * @example
 * // Basic usage (posts)
 * export const server = {
 *   updatePost: createUpdatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // Pages
 * export const server = {
 *   updatePage: createUpdatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *     resource: 'pages',
 *   }),
 * };
 */
export function createUpdatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof updatePostInputSchema = typeof updatePostInputSchema
>(config: UpdatePostActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? updatePostInputSchema) as TSchema;
  const resource = config.resource;
  const responseSchema = config.responseSchema;

  // TypeScript defers evaluation of ActionHandler<TSchema, …> when TSchema is a
  // generic parameter — `as any` is scoped to this call site only and does not
  // affect callers who still receive the full ActionClient<TResponse, undefined, TSchema> type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeUpdatePost<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, resource, responseSchema },
        input as UpdatePostInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
