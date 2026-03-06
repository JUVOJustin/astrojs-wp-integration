import { defineAction, ActionError, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { wordPressErrorSchema } from '../../schemas';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { executeActionRequest, type ExecuteActionAuthConfig } from '../post/client';

/**
 * Input schema for deleting a WordPress taxonomy term.
 *
 * WordPress requires `force=true` for term deletion because terms do not
 * support trashing.  The `force` field defaults to `true` and is exposed
 * only for API parity with the post delete schema.
 */
export const deleteTermInputSchema = z.object({
  /** ID of the term to delete */
  id: z.number().int().positive(),
  /** Must be true — terms do not support trashing (default: true) */
  force: z.boolean().optional(),
});

export type DeleteTermInput = z.infer<typeof deleteTermInputSchema>;

/**
 * Normalized result returned by `executeDeleteTerm`.
 * For terms, `deleted` is always `true` on success because WordPress does
 * not support moving terms to trash.
 */
export type DeleteTermResult = { id: number; deleted: boolean };

/**
 * Low-level config accepted by `executeDeleteTerm`.
 */
export interface ExecuteDeleteTermConfig extends ExecuteActionAuthConfig {
  /** REST resource path appended to `apiBase` (default: 'categories') */
  resource?: string;
}

/**
 * Configuration required to create the delete-term action factory.
 * At least one auth strategy is required because deleting terms needs write access.
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
 * Deletes a WordPress taxonomy term via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'tags'`,
 * `'genres'`).  Defaults to `'categories'`.
 *
 * WordPress requires `force=true` for term deletion — terms do not support
 * trashing.  This function always sends `force=true` regardless of input.
 *
 * On success the result is `{ id, deleted: true }`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeDeleteTerm(
  config: ExecuteDeleteTermConfig,
  input: DeleteTermInput
): Promise<DeleteTermResult> {
  const resource = config.resource ?? 'categories';

  // Terms always require force=true — trashing is not supported
  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'DELETE',
    endpoint: `/${resource}/${input.id}`,
    params: { force: 'true' },
  });

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  // WordPress returns { deleted: true, previous: <term> } on success
  if (
    typeof data === 'object' &&
    data !== null &&
    'deleted' in data &&
    (data as Record<string, unknown>).deleted === true
  ) {
    return { id: input.id, deleted: true };
  }

  // Unexpected shape — but the request succeeded, so the term is gone
  return { id: input.id, deleted: true };
}

/**
 * Creates a predefined Astro server action that deletes a WordPress taxonomy
 * term via the REST API.  Terms are always permanently deleted because
 * WordPress does not support trashing terms.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'tags'`).
 *
 * @example
 * export const server = {
 *   deleteCategory: createDeleteTermAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 */
export function createDeleteTermAction(
  config: DeleteTermActionConfig
): ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string {
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const resource = config.resource;

  return defineAction({
    input: deleteTermInputSchema,
    handler: async (input: DeleteTermInput, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeDeleteTerm({ apiBase, ...requestAuth, resource }, input);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ActionClient<DeleteTermResult, undefined, typeof deleteTermInputSchema> & string;
}
