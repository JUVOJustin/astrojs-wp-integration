import { defineAction, ActionError, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { wordPressErrorSchema } from '../../schemas';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { executeActionRequest, type ExecuteActionAuthConfig } from '../post/client';

const ABILITIES_BASE = '/wp-json/wp-abilities/v1';

/**
 * Input schema for executing a destructive WordPress ability via DELETE.
 *
 * @example
 * const result = await executeDeleteAbility(config, {
 *   name: 'my-plugin/delete-post',
 *   input: { post_id: 123 },
 * });
 */
export const deleteAbilityInputSchema = z.object({
  /** Full ability name in namespace/ability format (e.g. "my-plugin/delete-post") */
  name: z.string().min(1),
  /** Optional input data — sent as a URL-encoded JSON query parameter */
  input: z.unknown().optional(),
});

export type DeleteAbilityInput = z.infer<typeof deleteAbilityInputSchema>;

/**
 * Low-level config accepted by `executeDeleteAbility`.
 */
export interface ExecuteDeleteAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  /** Zod schema used to parse the response (default: none — returns raw data) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the delete-ability action factory.
 * At least one auth strategy is required because the Abilities API requires authentication.
 */
export interface DeleteAbilityActionConfig<T = unknown> {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** Optional parser override for the action response */
  responseSchema?: z.ZodType<T>;
}

/**
 * Executes a destructive WordPress ability via DELETE.
 *
 * Maps to `DELETE /wp-abilities/v1/{namespace}/{ability}/run`.
 * Destructive abilities (annotated with `destructive: true`) must use this method.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeDeleteAbility<T = unknown>(
  config: ExecuteDeleteAbilityConfig<T>,
  input: DeleteAbilityInput,
): Promise<T> {
  const params: Record<string, string> = {};
  if (input.input !== undefined) {
    params.input = JSON.stringify(input.input);
  }

  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'DELETE',
    endpoint: `${ABILITIES_BASE}/${input.name}/run`,
    params,
  });

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  if (config.responseSchema) {
    return config.responseSchema.parse(data);
  }

  return data as T;
}

/**
 * Creates a predefined Astro server action that executes a destructive
 * WordPress ability via DELETE.
 *
 * @example
 * export const server = {
 *   deleteOption: createDeleteAbilityAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 */
export function createDeleteAbilityAction<
  TResponse = unknown,
  TSchema extends typeof deleteAbilityInputSchema = typeof deleteAbilityInputSchema,
>(config: DeleteAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? deleteAbilityInputSchema) as TSchema;
  // apiBase uses /wp-json/wp/v2 so createActionClient can derive the site URL.
  // Ability endpoints use /wp-json/wp-abilities/v1 paths which the client resolves separately.
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeDeleteAbility<TResponse>(
        { apiBase, ...requestAuth, responseSchema },
        input as DeleteAbilityInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
