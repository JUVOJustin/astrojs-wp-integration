import type { ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';
import {
  runAbilityInputSchema,
  type RunAbilityInput,
} from 'fluent-wp-client/zod';
import {
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';
import {
  createAbilityAction,
  type AbilityActionOptions,
  type ExecuteAbilityOptions,
} from './factory';

/**
 * Input schema for executing one regular WordPress ability via POST.
 */
export { runAbilityInputSchema };
export type { RunAbilityInput };

/**
 * Low-level options accepted by `executeRunAbility`.
 */
export type ExecuteRunAbilityOptions<T = unknown> = ExecuteAbilityOptions<T>;

/**
 * @deprecated Use `ExecuteRunAbilityOptions` instead.
 */
export type ExecuteRunAbilityConfig<T = unknown> = ExecuteRunAbilityOptions<T>;

/**
 * Shared non-auth options accepted by the run-ability action factory.
 * @deprecated Use `RunAbilityActionOptions` instead.
 */
export type RunAbilityActionConfig<T = unknown> = AbilityActionOptions<T>;

type RunAbilityActionOptions<
  TResponse,
  TSchema extends typeof runAbilityInputSchema,
> = AbilityActionOptions<TResponse> & {
  schema?: TSchema;
};

/**
 * Executes one regular WordPress ability via the standalone client.
 */
export async function executeRunAbility<T = unknown>(
  client: WordPressClient,
  input: RunAbilityInput,
  options?: ExecuteRunAbilityOptions<T>,
): Promise<T> {
  return withActionClient(client, (resolvedClient) => resolvedClient.executeRunAbility(input.name, input.input, options?.responseSchema));
}

/**
 * Creates one predefined Astro server action for regular WordPress abilities.
 */
export function createRunAbilityAction<
  TResponse = unknown,
  TSchema extends typeof runAbilityInputSchema = typeof runAbilityInputSchema,
>(client: ResolvableActionClient, options?: RunAbilityActionOptions<TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<RunAbilityInput, TResponse, TSchema>({
    ...options,
    client,
    defaultSchema: runAbilityInputSchema as TSchema,
    execute: (resolvedClient, input, executeOptions) => executeRunAbility<TResponse>(resolvedClient, input, executeOptions),
  });
}
