import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';

/**
 * Input schema for deleting one WordPress term.
 */
export const deleteTermInputSchema = z.object({
  id: z.number().int().positive(),
  force: z.boolean().optional(),
});

export type DeleteTermInput = z.infer<typeof deleteTermInputSchema>;

/**
 * Normalized result returned by `executeDeleteTerm`.
 */
export type DeleteTermResult = { id: number; deleted: boolean };

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
  options?: ExecuteDeleteTermOptions,
): Promise<DeleteTermResult> {
  const resource = options?.resource ?? 'categories';

  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient.deleteTerm(resource, input.id, { force: input.force });
    return { id: result.id, deleted: result.deleted };
  });
}

/**
 * Creates one Astro server action that deletes taxonomy terms.
 */
export function createDeleteTermAction(
  client: ResolvableActionClient,
  options?: DeleteTermActionOptions,
): ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string {
  const resource = options?.resource;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: deleteTermInputSchema,
    handler: async (input: DeleteTermInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);
      return executeDeleteTerm(resolvedClient, input, { resource });
    },
  } as any) as ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string;
}
