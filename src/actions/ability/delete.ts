import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  deleteAbilityInputSchema as clientDeleteAbilityInputSchema,
  type DeleteAbilityInput as ClientDeleteAbilityInput,
} from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';

/**
 * Input schema for executing one destructive WordPress ability via DELETE.
 */
export const deleteAbilityInputSchema = clientDeleteAbilityInputSchema;

export type DeleteAbilityInput = ClientDeleteAbilityInput;

/**
 * Low-level config accepted by `executeDeleteAbility`.
 */
export interface ExecuteDeleteAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the destructive-ability action factory.
 */
export interface DeleteAbilityActionConfig<T = unknown> {
  baseUrl: string;
  auth?: ActionAuthConfig;
  authHeaders?: ResolvableActionAuthHeaders;
  responseSchema?: z.ZodType<T>;
}

/**
 * Executes one destructive WordPress ability via the standalone client.
 */
export async function executeDeleteAbility<T = unknown>(
  config: ExecuteDeleteAbilityConfig<T>,
  input: DeleteAbilityInput,
): Promise<T> {
  return withActionClient(config, (client) => client.executeDeleteAbility(input.name, input.input, config.responseSchema));
}

/**
 * Creates one predefined Astro server action for destructive WordPress abilities.
 */
export function createDeleteAbilityAction<
  TResponse = unknown,
  TSchema extends typeof deleteAbilityInputSchema = typeof deleteAbilityInputSchema,
>(config: DeleteAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? deleteAbilityInputSchema) as TSchema;
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
        { baseUrl: config.baseUrl, ...requestAuth, responseSchema },
        input as DeleteAbilityInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
