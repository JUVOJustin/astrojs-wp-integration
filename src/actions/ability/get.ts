import type { ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';
import {
  getAbilityInputSchema,
  type GetAbilityInput,
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
 * Input schema for executing one read-only WordPress ability via GET.
 */
export { getAbilityInputSchema };
export type { GetAbilityInput };

/**
 * Low-level options accepted by `executeGetAbility`.
 */
export type ExecuteGetAbilityOptions<T = unknown> = ExecuteAbilityOptions<T>;

/**
 * @deprecated Use `ExecuteGetAbilityOptions` instead.
 */
export type ExecuteGetAbilityConfig<T = unknown> = ExecuteGetAbilityOptions<T>;

/**
 * Shared non-auth options accepted by the read-only ability action factory.
 * @deprecated Use `GetAbilityActionOptions` instead.
 */
export type GetAbilityActionConfig<T = unknown> = AbilityActionOptions<T>;

type GetAbilityActionOptions<
  TResponse,
  TSchema extends typeof getAbilityInputSchema,
> = AbilityActionOptions<TResponse> & {
  schema?: TSchema;
};

/**
 * Executes one read-only WordPress ability via the standalone client.
 */
export async function executeGetAbility<T = unknown>(
  client: WordPressClient,
  input: GetAbilityInput,
  options?: ExecuteGetAbilityOptions<T>,
): Promise<T> {
  return withActionClient(client, (resolvedClient) => resolvedClient.executeGetAbility(input.name, input.input, options?.responseSchema));
}

/**
 * Creates one predefined Astro server action for read-only WordPress abilities.
 */
export function createGetAbilityAction<
  TResponse = unknown,
  TSchema extends typeof getAbilityInputSchema = typeof getAbilityInputSchema,
>(client: ResolvableActionClient, options?: GetAbilityActionOptions<TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<GetAbilityInput, TResponse, TSchema>({
    ...options,
    client,
    defaultSchema: getAbilityInputSchema as TSchema,
    execute: (resolvedClient, input, executeOptions) => executeGetAbility<TResponse>(resolvedClient, input, executeOptions),
  });
}
