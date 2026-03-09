import type { ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  getAbilityInputSchema as clientGetAbilityInputSchema,
  type GetAbilityInput as ClientGetAbilityInput,
} from 'fluent-wp-client';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';
import { createAbilityAction, type AbilityActionConfig } from './factory';

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
export interface GetAbilityActionConfig<T = unknown> extends AbilityActionConfig<T> {}

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
  return createAbilityAction<GetAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: getAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeGetAbility<TResponse>(executeConfig, input),
  });
}
