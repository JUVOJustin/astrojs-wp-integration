import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';

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
 * Low-level config accepted by `executeDeleteTerm`.
 */
export interface ExecuteDeleteTermConfig extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
}

/**
 * Configuration required to create the delete-term action factory.
 */
export interface DeleteTermActionConfig {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
}

/**
 * Deletes one WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeDeleteTerm(
  config: ExecuteDeleteTermConfig,
  input: DeleteTermInput
): Promise<DeleteTermResult> {
  const resource = config.resource ?? 'categories';

  return withActionClient(config, async (client) => {
    const result = await client.deleteTerm(resource, input.id, { force: input.force });
    return { id: result.id, deleted: result.deleted };
  });
}

/**
 * Creates one Astro server action that deletes taxonomy terms.
 */
export function createDeleteTermAction(
  config: DeleteTermActionConfig
): ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string {
  const resource = config.resource;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: deleteTermInputSchema,
    handler: async (input: DeleteTermInput, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeDeleteTerm({ baseUrl: config.baseUrl, ...requestAuth, resource }, input);
    },
  } as any) as ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string;
}
