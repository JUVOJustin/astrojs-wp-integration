import type { ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';
import {
  deleteAbilityInputSchema,
  type DeleteAbilityInput,
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
 * Input schema for executing one destructive WordPress ability via DELETE.
 */
export { deleteAbilityInputSchema };
export type { DeleteAbilityInput };

/**
 * Low-level options accepted by `executeDeleteAbility`.
 */
export type ExecuteDeleteAbilityOptions<T = unknown> = ExecuteAbilityOptions<T>;

/**
 * @deprecated Use `ExecuteDeleteAbilityOptions` instead.
 */
export type ExecuteDeleteAbilityConfig<T = unknown> = ExecuteDeleteAbilityOptions<T>;

/**
 * Shared non-auth options accepted by the destructive-ability action factory.
 * @deprecated Use `DeleteAbilityActionOptions` instead.
 */
export type DeleteAbilityActionConfig<T = unknown> = AbilityActionOptions<T>;

type DeleteAbilityActionOptions<
  TResponse,
  TSchema extends typeof deleteAbilityInputSchema,
> = AbilityActionOptions<TResponse> & {
  schema?: TSchema;
};

/**
 * Executes one destructive WordPress ability via the standalone client.
 */
export async function executeDeleteAbility<T = unknown>(
  client: WordPressClient,
  input: DeleteAbilityInput,
  options?: ExecuteDeleteAbilityOptions<T>,
): Promise<T> {
  return withActionClient(client, (resolvedClient) => resolvedClient.executeDeleteAbility(input.name, input.input, options?.responseSchema));
}

/**
 * Creates one predefined Astro server action for destructive WordPress abilities.
 */
export function createDeleteAbilityAction<
  TResponse = unknown,
  TSchema extends typeof deleteAbilityInputSchema = typeof deleteAbilityInputSchema,
>(client: ResolvableActionClient, options?: DeleteAbilityActionOptions<TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<DeleteAbilityInput, TResponse, TSchema>({
    ...options,
    client,
    defaultSchema: deleteAbilityInputSchema as TSchema,
    execute: (resolvedClient, input, executeOptions) => executeDeleteAbility<TResponse>(resolvedClient, input, executeOptions),
  });
}
