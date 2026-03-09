import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from './client';

/**
 * Input schema for deleting a WordPress post (or page / custom post type).
 * When `force` is true the post is permanently deleted; otherwise it is moved to the trash.
 */
export const deletePostInputSchema = z.object({
  id: z.number().int().positive(),
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
export interface ExecuteDeleteConfig extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
}

/**
 * Configuration required to create the delete-post action factory.
 * At least one auth strategy is required because deleting posts needs write access.
 */
export interface DeletePostActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
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

  return withActionClient(config, async (client) => {
    const result = await client.deleteContent(resource, input.id, { force: input.force });
    return { id: result.id, deleted: result.deleted };
  });
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
  const resource = config.resource;

  return defineAction({
    input: deletePostInputSchema,
    handler: async (input: DeletePostInput, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeDeletePost({ baseUrl: config.baseUrl, ...requestAuth, resource }, input);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeletePostResult, undefined, typeof deletePostInputSchema> & string;
}
