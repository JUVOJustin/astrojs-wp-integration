import type { ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';
import { deleteAbilityInputSchema } from 'fluent-wp-client/zod';
import type { DeleteAbilityInput } from 'fluent-wp-client/zod';

import { withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';
import { validateActionResponse } from '../response-validation';
import { createAbilityAction } from './factory';
import type { AbilityActionOptions, ExecuteAbilityOptions } from './factory';

export type { DeleteAbilityInput };

/**
 * Input schema for executing one destructive WordPress ability via DELETE.
 */
export { deleteAbilityInputSchema };

/**
 * Low-level options accepted by `executeDeleteAbility`.
 */
export type ExecuteDeleteAbilityOptions<T = unknown> = ExecuteAbilityOptions<T>;

/**
 * @deprecated Use `ExecuteDeleteAbilityOptions` instead.
 */
export type ExecuteDeleteAbilityConfig<T = unknown> =
  ExecuteDeleteAbilityOptions<T>;

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
  options?: ExecuteDeleteAbilityOptions<T>
): Promise<T> {
  return withActionClient(client, async (resolvedClient) => {
    const result = await resolvedClient.executeDeleteAbility(
      input.name,
      input.input
    );

    return validateActionResponse(
      result,
      options?.responseSchema,
      'WordPress ability DELETE action'
    );
  });
}

/**
 * Creates one predefined Astro server action for destructive WordPress abilities.
 */
export function createDeleteAbilityAction<
  TResponse = unknown,
  TSchema extends typeof deleteAbilityInputSchema =
    typeof deleteAbilityInputSchema,
>(
  client: ResolvableActionClient,
  options?: DeleteAbilityActionOptions<TResponse, TSchema>
): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<DeleteAbilityInput, TResponse, TSchema>({
    ...options,
    client,
    // SAFETY: The fallback is used only when no custom schema is supplied for this ability.
    defaultSchema: deleteAbilityInputSchema as TSchema,
    execute: (resolvedClient, input, executeOptions) =>
      executeDeleteAbility<TResponse>(resolvedClient, input, executeOptions),
  });
}
