import { defineAction, ActionError, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { createBasicAuthHeader, type BasicAuthCredentials } from '../../client/auth';
import { wordPressErrorSchema } from '../../schemas';

/**
 * Input schema for deleting a WordPress post (or page / custom post type).
 * When `force` is true the post is permanently deleted; otherwise it is moved to the trash.
 */
export const deletePostInputSchema = z.object({
  /** ID of the post to delete */
  id: z.number().int().positive(),
  /** Permanently delete instead of trashing (default: false) */
  force: z.boolean().optional(),
});

export type DeletePostInput = z.infer<typeof deletePostInputSchema>;

/**
 * Normalized result returned by `executeDeletePost`.
 * `deleted: true` means the post was permanently removed; `false` means it was trashed.
 */
export type DeletePostResult = { id: number; deleted: boolean };

/**
 * Low-level config accepted by `executeDeletePost`.
 */
export interface ExecuteDeleteConfig {
  /** Base URL up to but excluding the resource (e.g. 'http://example.com/wp-json/wp/v2') */
  apiBase: string;
  /** Pre-built Authorization header value */
  authHeader: string;
  /** REST resource path appended to `apiBase` (default: 'posts') */
  resource?: string;
}

/**
 * Configuration required to create the delete-post action factory.
 * Authentication is mandatory because deleting posts requires write access.
 */
export interface DeletePostActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Application-password credentials */
  auth: BasicAuthCredentials;
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
}

/**
 * Deletes a WordPress post (or page / CPT) via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`).  Defaults to `'posts'`.
 *
 * - `force=true`  → WP returns `{ deleted: true, previous: <post> }` → result `{ id, deleted: true }`
 * - `force=false` → WP moves the post to trash and returns the trashed post → result `{ id, deleted: false }`
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeDeletePost(
  config: ExecuteDeleteConfig,
  input: DeletePostInput
): Promise<DeletePostResult> {
  const resource = config.resource ?? 'posts';
  const url = new URL(`${config.apiBase}/${resource}/${input.id}`);
  if (input.force) {
    url.searchParams.set('force', 'true');
  }

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: config.authHeader,
    },
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  // Permanent delete returns { deleted: true, previous: <post> }
  if (
    typeof data === 'object' &&
    data !== null &&
    'deleted' in data &&
    (data as Record<string, unknown>).deleted === true
  ) {
    return { id: input.id, deleted: true };
  }

  // Trash returns the trashed post object
  return { id: input.id, deleted: false };
}

/**
 * Creates a predefined Astro server action that deletes a WordPress post
 * (or page / CPT) via the REST API.  Pass `force: true` in the input to
 * permanently delete the post instead of moving it to the trash.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'pages'`).
 *
 * @example
 * export const server = {
 *   deletePost: createDeletePostAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 */
export function createDeletePostAction(
  config: DeletePostActionConfig
): ActionClient<DeletePostResult, undefined, typeof deletePostInputSchema> & string {
  const authHeader = createBasicAuthHeader(config.auth);
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const resource = config.resource;

  return defineAction({
    input: deletePostInputSchema,
    handler: (input: DeletePostInput) => executeDeletePost({ apiBase, authHeader, resource }, input),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeletePostResult, undefined, typeof deletePostInputSchema> & string;
}
