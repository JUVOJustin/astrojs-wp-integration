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
 * Input schema for executing a WordPress ability via POST.
 *
 * @example
 * const result = await executeRunAbility(config, {
 *   name: 'my-plugin/update-option',
 *   input: { option_name: 'blogname', option_value: 'New Name' },
 * });
 */
export const runAbilityInputSchema = z.object({
  /** Full ability name in namespace/ability format (e.g. "my-plugin/update-option") */
  name: z.string().min(1),
  /** Optional input data — sent as JSON body */
  input: z.unknown().optional(),
});

export type RunAbilityInput = z.infer<typeof runAbilityInputSchema>;

/**
 * Low-level config accepted by `executeRunAbility`.
 */
export interface ExecuteRunAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  /** Zod schema used to parse the response (default: none — returns raw data) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the run-ability action factory.
 * At least one auth strategy is required because the Abilities API requires authentication.
 */
export interface RunAbilityActionConfig<T = unknown> {
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
 * Executes a WordPress ability via POST.
 *
 * Maps to `POST /wp-abilities/v1/{namespace}/{ability}/run`.
 * Regular abilities (annotated with `readonly: false`, `destructive: false`)
 * must use this method.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeRunAbility<T = unknown>(
  config: ExecuteRunAbilityConfig<T>,
  input: RunAbilityInput,
): Promise<T> {
  const body: Record<string, unknown> = {};
  if (input.input !== undefined) {
    body.input = input.input;
  }

  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'POST',
    endpoint: `${ABILITIES_BASE}/${input.name}/run`,
    body: Object.keys(body).length > 0 ? body : undefined,
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
 * Creates a predefined Astro server action that executes a WordPress
 * ability via POST.
 *
 * @example
 * export const server = {
 *   updateOption: createRunAbilityAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 */
export function createRunAbilityAction<
  TResponse = unknown,
  TSchema extends typeof runAbilityInputSchema = typeof runAbilityInputSchema,
>(config: RunAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? runAbilityInputSchema) as TSchema;
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

      return executeRunAbility<TResponse>(
        { apiBase, ...requestAuth, responseSchema },
        input as RunAbilityInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
