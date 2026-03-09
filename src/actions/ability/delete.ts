import type { ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  deleteAbilityInputSchema as clientDeleteAbilityInputSchema,
  type DeleteAbilityInput as ClientDeleteAbilityInput,
} from 'fluent-wp-client';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';
import { createAbilityAction, type AbilityActionConfig } from './factory';

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
export interface DeleteAbilityActionConfig<T = unknown> extends AbilityActionConfig<T> {}

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
  return createAbilityAction<DeleteAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: deleteAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeDeleteAbility<TResponse>(executeConfig, input),
  });
}
