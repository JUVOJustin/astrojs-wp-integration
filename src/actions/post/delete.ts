import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from './client';

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
 * Low-level options accepted by `executeDeletePost`.
 */
export interface ExecuteDeleteOptions {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
}

/**
 * @deprecated Use `ExecuteDeleteOptions` instead.
 */
export type ExecuteDeleteConfig = ExecuteDeleteOptions;

/**
 * Shared non-auth options accepted by the delete-post action factory.
 */
export interface DeletePostActionOptions {
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
}

/**
 * @deprecated Use `DeletePostActionOptions` instead.
 */
export type DeletePostActionConfig = DeletePostActionOptions;

/**
 * Deletes a WordPress post (or page / CPT) via the REST API.
 *
 * Set `options.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`). Defaults to `'posts'`.
 */
export async function executeDeletePost(
  client: WordPressClient,
  input: DeletePostInput,
  options?: ExecuteDeleteOptions,
): Promise<DeletePostResult> {
  const resource = options?.resource ?? 'posts';

  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient.deleteContent(resource, input.id, { force: input.force });
    return { id: result.id, deleted: result.deleted };
  });
}

/**
 * Creates a predefined Astro server action that deletes a WordPress post
 * (or page / CPT) via the REST API. Pass `force: true` in the input to
 * permanently delete the post instead of moving it to the trash.
 */
export function createDeletePostAction(
  client: ResolvableActionClient,
  options?: DeletePostActionOptions,
): ActionClient<DeletePostResult, undefined, typeof deletePostInputSchema> & string {
  const resource = options?.resource;

  return defineAction({
    input: deletePostInputSchema,
    handler: async (input: DeletePostInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);
      return executeDeletePost(resolvedClient, input, { resource });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeletePostResult, undefined, typeof deletePostInputSchema> & string;
}
