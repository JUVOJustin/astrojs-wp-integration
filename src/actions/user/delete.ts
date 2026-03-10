import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';

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
 * Low-level config accepted by `executeDeleteUser`.
 */
export interface ExecuteDeleteUserConfig extends ExecuteActionAuthConfig {}

/**
 * Configuration required to create the delete-user action factory.
 */
export interface DeleteUserActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
}

/**
 * Deletes a WordPress user via the REST API.
 */
export async function executeDeleteUser(
  config: ExecuteDeleteUserConfig,
  input: DeleteUserInput,
): Promise<DeleteUserResult> {
  return withActionClient(config, async (client) => {
    const result = await client.deleteUser(input.id, { force: true, reassign: input.reassign });
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
  config: DeleteUserActionConfig,
): ActionClient<DeleteUserResult, undefined, typeof deleteUserInputSchema> & string {
  return defineAction({
    input: deleteUserInputSchema,
    handler: async (input: DeleteUserInput, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeDeleteUser({ baseUrl: config.baseUrl, ...requestAuth }, input);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeleteUserResult, undefined, typeof deleteUserInputSchema> & string;
}
