import { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';

import { resolveRequiredActionClient, withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';

/**
 * Input schema for deleting a WordPress user.
 */
export const deleteUserInputSchema = z.object({
  force: z.literal(true).optional(),
  id: z.number().int().positive(),
  reassign: z.number().int().positive(),
});

export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>;

/**
 * Normalized result returned by `executeDeleteUser`.
 */
export interface DeleteUserResult {
  id: number;
  deleted: boolean;
  reassignedTo: number;
}

/**
 * Low-level options accepted by `executeDeleteUser`.
 */
export type ExecuteDeleteUserOptions = object;

/**
 * @deprecated Use `ExecuteDeleteUserOptions` instead.
 */
export type ExecuteDeleteUserConfig = ExecuteDeleteUserOptions;

/**
 * Shared non-auth options accepted by the delete-user action factory.
 */
export type DeleteUserActionOptions = object;

/**
 * @deprecated Use `DeleteUserActionOptions` instead.
 */
export type DeleteUserActionConfig = DeleteUserActionOptions;

/**
 * Deletes a WordPress user via the REST API.
 */
export async function executeDeleteUser(
  client: WordPressClient,
  input: DeleteUserInput
): Promise<DeleteUserResult> {
  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient
      .users()
      .delete(input.id, { force: true, reassign: input.reassign });

    return {
      deleted: result.deleted,
      id: result.id,
      reassignedTo: input.reassign,
    };
  });
}

/**
 * Creates a predefined Astro server action that deletes a WordPress user.
 */
export function createDeleteUserAction(
  client: ResolvableActionClient
): ActionClient<DeleteUserResult, undefined, typeof deleteUserInputSchema> &
  string {
  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: deleteUserInputSchema,
    handler: async (input: DeleteUserInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeDeleteUser(resolvedClient, input);
    },
  }) as ActionClient<
    DeleteUserResult,
    undefined,
    typeof deleteUserInputSchema
  > &
    string;
}
