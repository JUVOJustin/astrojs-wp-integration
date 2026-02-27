import { defineAction, ActionError, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../../client/auth';
import { postWriteBaseSchema, wordPressErrorSchema, postSchema } from '../../schemas';
import type { WordPressPost } from '../../schemas';

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
export interface ExecuteCreateConfig<T = WordPressPost> {
  /** Base URL up to but excluding the resource (e.g. 'http://example.com/wp-json/wp/v2') */
  apiBase: string;
  /** Pre-built Authorization header value */
  authHeader: string;
  /** REST resource path appended to `apiBase` (default: 'posts') */
  resource?: string;
  /** Zod schema used to parse the response (default: postSchema) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the create-post action factory.
 * Authentication is mandatory because creating posts requires write access.
 */
export interface CreatePostActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Application-password credentials */
  auth: BasicAuthCredentials;
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
}

/**
 * Creates a new WordPress post (or page / CPT) via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `config.responseSchema` to parse the response with a
 * matching Zod schema.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeCreatePost<T = WordPressPost>(
  config: ExecuteCreateConfig<T>,
  input: CreatePostInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'posts';

  // Only include fields that were explicitly provided
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  const response = await fetch(`${config.apiBase}/${resource}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.authHeader,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  const responseSchema = (config.responseSchema ?? postSchema) as z.ZodType<T>;
  return responseSchema.parse(data);
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
  TSchema extends typeof createPostInputSchema = typeof createPostInputSchema
>(config: CreatePostActionConfig & { schema?: TSchema }): ActionClient<WordPressPost, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createPostInputSchema) as TSchema;
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const resource = config.resource;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: (input: z.infer<TSchema>) =>
      executeCreatePost({ apiBase, authHeader, resource }, input as CreatePostInput & Record<string, unknown>),
  } as any) as ActionClient<WordPressPost, undefined, TSchema> & string;
}
