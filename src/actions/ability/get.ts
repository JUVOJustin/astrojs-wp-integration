import type { ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';
import {
  type GetAbilityInput,
  getAbilityInputSchema,
} from 'fluent-wp-client/zod';
import { type ResolvableActionClient, withActionClient } from '../post/client';
import { validateActionResponse } from '../response-validation';
import {
  type AbilityActionOptions,
  createAbilityAction,
  type ExecuteAbilityOptions,
} from './factory';

export type { GetAbilityInput };
/**
 * Input schema for executing one read-only WordPress ability via GET.
 */
export { getAbilityInputSchema };

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
  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient.executeGetAbility(
      input.name,
      input.input,
    );
    return validateActionResponse(
      result,
      options?.responseSchema,
      'WordPress ability GET action',
    );
  });
}

/**
 * Creates one predefined Astro server action for read-only WordPress abilities.
 */
export function createGetAbilityAction<
  TResponse = unknown,
  TSchema extends typeof getAbilityInputSchema = typeof getAbilityInputSchema,
>(
  client: ResolvableActionClient,
  options?: GetAbilityActionOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<GetAbilityInput, TResponse, TSchema>({
    ...options,
    client,
    defaultSchema: getAbilityInputSchema as TSchema,
    execute: (resolvedClient, input, executeOptions) =>
      executeGetAbility<TResponse>(resolvedClient, input, executeOptions),
  });
}
