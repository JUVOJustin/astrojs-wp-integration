import { defineAction, ActionError, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { postWriteBaseSchema, wordPressErrorSchema, postSchema, pageSchema, contentWordPressSchema } from '../../schemas';
import type { WordPressPost, WordPressPage, WordPressContent } from '../../schemas';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { executeActionRequest, type ExecuteActionAuthConfig } from './client';

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
  /** ID of the post to update (required) */
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
  /** REST resource path appended to `apiBase` (default: 'posts') */
  resource?: string;
  /** Zod schema used to parse the response (default: postSchema) */
  responseSchema?: z.ZodType<T>;
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
  responseSchema?: z.ZodType<T>;
}

/**
 * Resolves the default response schema for a given resource endpoint.
 *
 * Posts map to `postSchema`, pages map to `pageSchema`, and other post-like
 * resources (CPTs) fall back to `contentWordPressSchema`.
 */
function getDefaultResponseSchema(resource: string): z.ZodType<WordPressPost | WordPressPage | WordPressContent> {
  if (resource === 'posts') {
    return postSchema;
  }

  if (resource === 'pages') {
    return pageSchema;
  }

  return contentWordPressSchema;
}

/**
 * Updates an existing WordPress post (or page / CPT) via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `config.responseSchema` to parse the response with a
 * matching Zod schema.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeUpdatePost<T = WordPressPost>(
  config: ExecuteUpdateConfig<T>,
  input: UpdatePostInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'posts';
  const { id, ...fields } = input;

  // Only include fields that were explicitly provided; custom fields pass through as-is
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  // WordPress REST API uses POST (not PUT/PATCH) for updating existing posts
  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'POST',
    endpoint: `/${resource}/${id}`,
    body,
  });

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  const responseSchema = (config.responseSchema ?? getDefaultResponseSchema(resource)) as z.ZodType<T>;
  return responseSchema.parse(data);
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
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const resource = config.resource;
  const responseSchema = config.responseSchema;

  // TypeScript defers evaluation of ActionHandler<TSchema, …> when TSchema is a
  // generic parameter — `as any` is scoped to this call site only and does not
  // affect callers who still receive the full ActionClient<WordPressPost, undefined, TSchema> type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeUpdatePost<TResponse>(
        { apiBase, ...requestAuth, resource, responseSchema },
        input as UpdatePostInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
