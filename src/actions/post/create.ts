import { defineAction, ActionError, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../../client/auth';
import { postWriteBaseSchema, wordPressErrorSchema, postSchema } from '../../schemas';
import type { WordPressPost } from '../../schemas';

/**
 * Input schema for creating a new WordPress post.
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
 * Configuration required to create the create-post action.
 * Authentication is mandatory because creating posts requires write access.
 */
export interface CreatePostActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Application-password credentials */
  auth: BasicAuthCredentials;
}

/**
 * Executes a WordPress post creation via the REST API.
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeCreatePost(
  config: { apiBase: string; authHeader: string },
  input: CreatePostInput & Record<string, unknown>
): Promise<WordPressPost> {
  // Only include fields that were explicitly provided
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  const response = await fetch(`${config.apiBase}/posts`, {
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

  return postSchema.parse(data) as WordPressPost;
}

/**
 * Creates a predefined Astro server action that creates a new WordPress post
 * via the REST API.  All provided fields are forwarded to WordPress, and any
 * error is surfaced as an `ActionError`.
 *
 * Pass a custom `schema` (created via `createPostInputSchema.extend(...)`) to
 * support custom fields such as ACF data end-to-end.
 *
 * @example
 * // Basic usage
 * export const server = {
 *   createPost: createCreatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // With extended schema for ACF fields
 * const mySchema = createPostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 * export const server = {
 *   createPost: createCreatePostAction({ baseUrl, auth, schema: mySchema }),
 * };
 */
export function createCreatePostAction<
  TSchema extends typeof createPostInputSchema = typeof createPostInputSchema
>(config: CreatePostActionConfig & { schema?: TSchema }): ActionClient<WordPressPost, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createPostInputSchema) as TSchema;
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: (input: z.infer<TSchema>) =>
      executeCreatePost({ apiBase, authHeader }, input as CreatePostInput & Record<string, unknown>),
  } as any) as ActionClient<WordPressPost, undefined, TSchema> & string;
}
