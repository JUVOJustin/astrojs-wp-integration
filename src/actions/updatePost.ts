import { defineAction, ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../client/auth';
import { wordPressErrorSchema, postSchema } from '../schemas';
import type { WordPressPost } from '../schemas';

/**
 * Schema for the input fields of a WordPress post update.
 * All fields except `id` are optional – only provided fields are sent to the API.
 *
 * Reuses concepts from `postSchema` / `contentWordPressSchema` but uses raw
 * (writeable) values instead of rendered objects, as required by the REST API.
 */
export const updatePostInputSchema = z.object({
  /** ID of the post to update (required) */
  id: z.number().int().positive(),
  /** ISO 8601 publish date */
  date: z.string().optional(),
  /** ISO 8601 publish date in GMT */
  date_gmt: z.string().optional(),
  /** Post slug */
  slug: z.string().optional(),
  /** Post status */
  status: z.enum(['publish', 'draft', 'pending', 'private', 'future']).optional(),
  /** Post title (raw string) */
  title: z.string().optional(),
  /** Post content (raw HTML/blocks string) */
  content: z.string().optional(),
  /** Post excerpt (raw string) */
  excerpt: z.string().optional(),
  /** Author user ID */
  author: z.number().int().optional(),
  /** Featured image attachment ID */
  featured_media: z.number().int().optional(),
  /** Comment status */
  comment_status: z.enum(['open', 'closed']).optional(),
  /** Ping status */
  ping_status: z.enum(['open', 'closed']).optional(),
  /** Post format */
  format: z
    .enum(['standard', 'aside', 'chat', 'gallery', 'link', 'image', 'quote', 'status', 'video', 'audio'])
    .optional(),
  /** Post meta fields */
  meta: z.record(z.any()).optional(),
  /** Whether the post is sticky */
  sticky: z.boolean().optional(),
  /** Page template filename */
  template: z.string().optional(),
  /** Array of category IDs */
  categories: z.array(z.number().int()).optional(),
  /** Array of tag IDs */
  tags: z.array(z.number().int()).optional(),
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
 * @example
 * // src/actions/index.ts
 * import { createUpdatePostAction } from 'wp-astrojs-integration/actions';
 *
 * export const server = {
 *   updatePost: createUpdatePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: {
 *       username: import.meta.env.WP_USERNAME,
 *       password: import.meta.env.WP_APP_PASSWORD,
 *     },
 *   }),
 * };
 */
export function createUpdatePostAction(config: UpdatePostActionConfig) {
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;

  return defineAction({
    input: updatePostInputSchema,
    handler: async (input): Promise<WordPressPost> => {
      const { id, ...fields } = input;

      // Build the request body – only include fields that were explicitly provided
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
  });
}
