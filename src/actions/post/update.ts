import { defineAction, ActionError, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../../client/auth';
import { postWriteBaseSchema, wordPressErrorSchema, postSchema } from '../../schemas';
import type { WordPressPost } from '../../schemas';

/**
 * Full input schema for a WordPress post update.
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
 * Configuration required to create the update-post action.
 * Authentication is mandatory because editing posts requires write access.
 */
export interface UpdatePostActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Application-password credentials */
  auth: BasicAuthCredentials;
}

/**
 * Executes a WordPress post update via the REST API.
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeUpdatePost(
  config: { apiBase: string; authHeader: string },
  input: UpdatePostInput & Record<string, unknown>
): Promise<WordPressPost> {
  const { id, ...fields } = input;

  // Only include fields that were explicitly provided; custom fields pass through as-is
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  // WordPress REST API uses POST (not PUT/PATCH) for updating existing posts
  const response = await fetch(`${config.apiBase}/posts/${id}`, {
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
 * Creates a predefined Astro server action that updates a WordPress post via
 * the REST API.  All provided fields are passed through to WordPress, and any
 * error returned by WordPress is surfaced as an `ActionError`.
 *
 * Pass a custom `schema` (created via `updatePostInputSchema.extend(...)`) to
 * include extra fields such as ACF data or other custom plugin fields.
 *
 * @example
 * // Basic usage
 * export const server = {
 *   updatePost: createUpdatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // With extended schema for ACF fields
 * const mySchema = updatePostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 * export const server = {
 *   updatePost: createUpdatePostAction({ baseUrl, auth, schema: mySchema }),
 * };
 */
export function createUpdatePostAction<
  TSchema extends typeof updatePostInputSchema = typeof updatePostInputSchema
>(config: UpdatePostActionConfig & { schema?: TSchema }): ActionClient<WordPressPost, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? updatePostInputSchema) as TSchema;
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;

  // TypeScript defers evaluation of ActionHandler<TSchema, …> when TSchema is a
  // generic parameter — `as any` is scoped to this call site only and does not
  // affect callers who still receive the full ActionClient<WordPressPost, undefined, TSchema> type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: (input: z.infer<TSchema>) =>
      executeUpdatePost({ apiBase, authHeader }, input as UpdatePostInput & Record<string, unknown>),
  } as any) as ActionClient<WordPressPost, undefined, TSchema> & string;
}
