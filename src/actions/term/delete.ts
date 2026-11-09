import { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';

import { resolveRequiredActionClient, withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';

/**
 * Input schema for deleting one WordPress term.
 */
export const deleteTermInputSchema = z.object({
  force: z.boolean().optional(),
  id: z.number().int().positive(),
});

export type DeleteTermInput = z.infer<typeof deleteTermInputSchema>;

/**
 * Normalized result returned by `executeDeleteTerm`.
 */
export interface DeleteTermResult {
  id: number;
  deleted: boolean;
}

/**
 * Low-level options accepted by `executeDeleteTerm`.
 */
export interface ExecuteDeleteTermOptions {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
}

/**
 * @deprecated Use `ExecuteDeleteTermOptions` instead.
 */
export type ExecuteDeleteTermConfig = ExecuteDeleteTermOptions;

/**
 * Shared non-auth options accepted by the delete-term action factory.
 */
export interface DeleteTermActionOptions {
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
}

/**
 * @deprecated Use `DeleteTermActionOptions` instead.
 */
export type DeleteTermActionConfig = DeleteTermActionOptions;

/**
 * Deletes one WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeDeleteTerm(
  client: WordPressClient,
  input: DeleteTermInput,
  options?: ExecuteDeleteTermOptions
): Promise<DeleteTermResult> {
  const resource = options?.resource ?? 'categories';

  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient
      .terms(resource)
      .delete(input.id, { force: input.force });

    return { deleted: result.deleted, id: result.id };
  });
}

/**
 * Creates one Astro server action that deletes taxonomy terms.
 */
export function createDeleteTermAction(
  client: ResolvableActionClient,
  options?: DeleteTermActionOptions
): ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> &
  string {
  const resource = options?.resource;

  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: deleteTermInputSchema,
    handler: async (input: DeleteTermInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeDeleteTerm(resolvedClient, input, { resource });
    },
  }) as ActionClient<
    DeleteTermResult,
    undefined,
    typeof deleteTermInputSchema
  > &
    string;
}
