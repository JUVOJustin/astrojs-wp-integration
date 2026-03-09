import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  getAbilityInputSchema as clientGetAbilityInputSchema,
  type GetAbilityInput as ClientGetAbilityInput,
} from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';

/**
 * Input schema for executing one read-only WordPress ability via GET.
 */
export const getAbilityInputSchema = clientGetAbilityInputSchema;

export type GetAbilityInput = ClientGetAbilityInput;

/**
 * Low-level config accepted by `executeGetAbility`.
 */
export interface ExecuteGetAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the read-only ability action factory.
 */
export interface GetAbilityActionConfig<T = unknown> {
  baseUrl: string;
  auth?: ActionAuthConfig;
  authHeaders?: ResolvableActionAuthHeaders;
  responseSchema?: z.ZodType<T>;
}

/**
 * Executes one read-only WordPress ability via the standalone client.
 */
export async function executeGetAbility<T = unknown>(
  config: ExecuteGetAbilityConfig<T>,
  input: GetAbilityInput,
): Promise<T> {
  return withActionClient(config, (client) => client.executeGetAbility(input.name, input.input, config.responseSchema));
}

/**
 * Creates one predefined Astro server action for read-only WordPress abilities.
 */
export function createGetAbilityAction<
  TResponse = unknown,
  TSchema extends typeof getAbilityInputSchema = typeof getAbilityInputSchema,
>(config: GetAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? getAbilityInputSchema) as TSchema;
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
        { baseUrl: config.baseUrl, ...requestAuth, responseSchema },
        input as GetAbilityInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
