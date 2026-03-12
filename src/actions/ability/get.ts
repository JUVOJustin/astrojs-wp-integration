import type { ActionClient } from 'astro:actions';
import {
  getAbilityInputSchema,
  type GetAbilityInput,
} from 'fluent-wp-client';
import { withActionClient } from '../post/client';
import {
  createAbilityAction,
  type AbilityActionConfig,
  type ExecuteAbilityConfig,
} from './factory';

/**
 * Input schema for executing one read-only WordPress ability via GET.
 * Re-exported from fluent-wp-client for backward compatibility.
 * @deprecated Import directly from 'fluent-wp-client' in new code.
 */
export { getAbilityInputSchema };
export type { GetAbilityInput };

/**
 * Low-level config accepted by `executeGetAbility`.
 */
export type ExecuteGetAbilityConfig<T = unknown> = ExecuteAbilityConfig<T>;

/**
 * Configuration required to create the read-only ability action factory.
 * @deprecated Use AbilityActionConfig directly from factory.
 */
export type GetAbilityActionConfig<T = unknown> = AbilityActionConfig<T>;

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
>(config: AbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<GetAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: getAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeGetAbility<TResponse>(executeConfig, input),
  });
}
