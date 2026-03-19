import type { ActionClient } from 'astro:actions';
import {
  runAbilityInputSchema,
  type RunAbilityInput,
} from 'fluent-wp-client/zod';
import { withActionClient } from '../post/client';
import {
  createAbilityAction,
  type AbilityActionConfig,
  type ExecuteAbilityConfig,
} from './factory';

/**
 * Input schema for executing one regular WordPress ability via POST.
 */
export { runAbilityInputSchema };
export type { RunAbilityInput };

/**
 * Low-level config accepted by `executeRunAbility`.
 */
export type ExecuteRunAbilityConfig<T = unknown> = ExecuteAbilityConfig<T>;

/**
 * Configuration required to create the run-ability action factory.
 * @deprecated Use AbilityActionConfig directly from factory.
 */
export type RunAbilityActionConfig<T = unknown> = AbilityActionConfig<T>;

/**
 * Executes one regular WordPress ability via the standalone client.
 */
export async function executeRunAbility<T = unknown>(
  config: ExecuteRunAbilityConfig<T>,
  input: RunAbilityInput,
): Promise<T> {
  return withActionClient(config, (client) => client.executeRunAbility(input.name, input.input, config.responseSchema));
}

/**
 * Creates one predefined Astro server action for regular WordPress abilities.
 */
export function createRunAbilityAction<
  TResponse = unknown,
  TSchema extends typeof runAbilityInputSchema = typeof runAbilityInputSchema,
>(config: AbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<RunAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: runAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeRunAbility<TResponse>(executeConfig, input),
  });
}
