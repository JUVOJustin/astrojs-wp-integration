import { defineAction, ActionError, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../client/auth';
import { updatePostFieldsSchema, wordPressErrorSchema, postSchema } from '../schemas';
import type { WordPressPost } from '../schemas';

/**
 * Full input schema for a WordPress post update.
 *
 * Built on top of `updatePostFieldsSchema` (the shared writable scalar fields
 * that are common to both GET responses and POST request bodies) with the
 * addition of `id` and the three rendered fields whose write form differs from
 * the read form (`title`, `content`, `excerpt` are raw strings here, whereas
 * the REST API returns them as `{ rendered: string }` objects).
 *
 * Extend this schema to add custom fields such as ACF data:
 *
 * @example
 * const myUpdateSchema = updatePostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 *
 * Pass the extended schema to `createUpdatePostAction` via the `schema` option.
 */
export const updatePostInputSchema = updatePostFieldsSchema.extend({
  /** ID of the post to update (required) */
  id: z.number().int().positive(),
  /** Post title (raw string – WordPress stores and returns this as { rendered }) */
  title: z.string().optional(),
  /** Post content (raw HTML/blocks – returned as { rendered, protected }) */
  content: z.string().optional(),
  /** Post excerpt (raw string – returned as { rendered, protected }) */
  excerpt: z.string().optional(),
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
 * Creates a predefined Astro server action that updates a WordPress post via
 * the REST API.  All provided fields are passed through to WordPress, and any
 * error returned by WordPress is surfaced as an `ActionError`.
 *
 * Pass a custom `schema` (created via `updatePostInputSchema.extend(...)`) to
 * include extra fields such as ACF data or other custom plugin fields in the
 * action input.  The extra fields are automatically forwarded in the request
 * body to the WordPress REST API.
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
 * import { updatePostInputSchema } from 'wp-astrojs-integration';
 *
 * const mySchema = updatePostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 *
 * export const server = {
 *   updatePost: createUpdatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *     schema: mySchema,
 *   }),
 * };
 */
export function createUpdatePostAction<
  TSchema extends typeof updatePostInputSchema = typeof updatePostInputSchema
>(config: UpdatePostActionConfig & { schema?: TSchema }): ActionClient<WordPressPost, undefined, TSchema> & string {
  // Note: `& string` is part of Astro's defineAction return type and is required
  // for actions to be used as HTML form action attributes.
  const inputSchema = (config.schema ?? updatePostInputSchema) as TSchema;
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;

  // TypeScript defers evaluation of the ActionHandler<TSchema, …> conditional
  // type when TSchema is still a generic type parameter, making the handler
  // un-assignable without a cast.  The explicit return type annotation above
  // ensures callers still receive the full ActionClient<WordPressPost, undefined,
  // TSchema> type (including correct input inference for any extended schema).
  // The `as any` is scoped to this single call site and does not affect callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>) => {
      const { id, ...fields } = input as UpdatePostInput & Record<string, unknown>;

      // Build the request body – only include fields that were explicitly provided.
      // Unknown/custom fields (ACF, custom meta, etc.) are included as-is.
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          body[key] = value;
        }
      }

      // WordPress REST API uses POST (not PUT/PATCH) for updating existing posts
      const response = await fetch(`${apiBase}/posts/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        // Parse the WordPress error to surface its code and message
        const wpError = wordPressErrorSchema.safeParse(data);
        const message = wpError.success
          ? wpError.data.message
          : `WordPress API error: ${response.status} ${response.statusText}`;
        const code = ActionError.statusToCode(response.status);

        throw new ActionError({ code, message });
      }

      return postSchema.parse(data) as WordPressPost;
    },
  } as any) as ActionClient<WordPressPost, undefined, TSchema> & string;
}
