import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';

/**
 * Input schema for deleting a WordPress user.
 */
export const deleteUserInputSchema = z.object({
  id: z.number().int().positive(),
  reassign: z.number().int().positive(),
  force: z.literal(true).optional(),
});

export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>;

/**
 * Normalized result returned by `executeDeleteUser`.
 */
export type DeleteUserResult = {
  id: number;
  deleted: boolean;
  reassignedTo: number;
};

/**
 * Low-level options accepted by `executeDeleteUser`.
 */
export interface ExecuteDeleteUserOptions {}

/**
 * @deprecated Use `ExecuteDeleteUserOptions` instead.
 */
export type ExecuteDeleteUserConfig = ExecuteDeleteUserOptions;

/**
 * Shared non-auth options accepted by the delete-user action factory.
 */
export interface DeleteUserActionOptions {}

/**
 * @deprecated Use `DeleteUserActionOptions` instead.
 */
export type DeleteUserActionConfig = DeleteUserActionOptions;

/**
 * Deletes a WordPress user via the REST API.
 */
export async function executeDeleteUser(
  client: WordPressClient,
  input: DeleteUserInput,
): Promise<DeleteUserResult> {
  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient.users().delete(input.id, { force: true, reassign: input.reassign });
    return {
      id: result.id,
      deleted: result.deleted,
      reassignedTo: input.reassign,
    };
  });
}

/**
 * Creates a predefined Astro server action that deletes a WordPress user.
 */
export function createDeleteUserAction(
  client: ResolvableActionClient,
): ActionClient<DeleteUserResult, undefined, typeof deleteUserInputSchema> & string {
  return defineAction({
    input: deleteUserInputSchema,
    handler: async (input: DeleteUserInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);
      return executeDeleteUser(resolvedClient, input);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeleteUserResult, undefined, typeof deleteUserInputSchema> & string;
}
