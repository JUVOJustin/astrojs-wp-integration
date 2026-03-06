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
 * Input schema for executing a read-only WordPress ability via GET.
 *
 * @example
 * const result = await executeGetAbility(config, {
 *   name: 'my-plugin/get-site-info',
 * });
 */
export const getAbilityInputSchema = z.object({
  /** Full ability name in namespace/ability format (e.g. "my-plugin/get-site-info") */
  name: z.string().min(1),
  /** Optional input data — sent as a URL-encoded JSON query parameter */
  input: z.unknown().optional(),
});

export type GetAbilityInput = z.infer<typeof getAbilityInputSchema>;

/**
 * Low-level config accepted by `executeGetAbility`.
 */
export interface ExecuteGetAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  /** Zod schema used to parse the response (default: none — returns raw data) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the get-ability action factory.
 * At least one auth strategy is required because the Abilities API requires authentication.
 */
export interface GetAbilityActionConfig<T = unknown> {
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
 * Executes a read-only WordPress ability via GET.
 *
 * Maps to `GET /wp-abilities/v1/{namespace}/{ability}/run`.
 * Read-only abilities (annotated with `readonly: true`) must use this method.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeGetAbility<T = unknown>(
  config: ExecuteGetAbilityConfig<T>,
  input: GetAbilityInput,
): Promise<T> {
  const params: Record<string, string> = {};
  if (input.input !== undefined) {
    params.input = JSON.stringify(input.input);
  }

  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'GET',
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
 * Creates a predefined Astro server action that executes a read-only
 * WordPress ability via GET.
 *
 * @example
 * export const server = {
 *   getSiteInfo: createGetAbilityAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 */
export function createGetAbilityAction<
  TResponse = unknown,
  TSchema extends typeof getAbilityInputSchema = typeof getAbilityInputSchema,
>(config: GetAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? getAbilityInputSchema) as TSchema;
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

      return executeGetAbility<TResponse>(
        { apiBase, ...requestAuth, responseSchema },
        input as GetAbilityInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
