import type { ActionClient } from 'astro/actions/runtime/server.js';
import {
  deleteAbilityInputSchema,
  type DeleteAbilityInput,
} from 'fluent-wp-client';
import { withActionClient } from '../post/client';
import {
  createAbilityAction,
  type AbilityActionConfig,
  type ExecuteAbilityConfig,
} from './factory';

/**
 * Input schema for executing one destructive WordPress ability via DELETE.
 * Re-exported from fluent-wp-client for backward compatibility.
 * @deprecated Import directly from 'fluent-wp-client' in new code.
 */
export { deleteAbilityInputSchema };
export type { DeleteAbilityInput };

/**
 * Low-level config accepted by `executeDeleteAbility`.
 */
export type ExecuteDeleteAbilityConfig<T = unknown> = ExecuteAbilityConfig<T>;

/**
 * Configuration required to create the destructive-ability action factory.
 * @deprecated Use AbilityActionConfig directly from factory.
 */
export type DeleteAbilityActionConfig<T = unknown> = AbilityActionConfig<T>;

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
>(config: AbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<DeleteAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: deleteAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeDeleteAbility<TResponse>(executeConfig, input),
  });
}
