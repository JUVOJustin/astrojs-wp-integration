import type { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import type {
  WordPressClient,
  WordPressStandardSchema,
} from 'fluent-wp-client';

import { resolveRequiredActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';

/**
 * Shared action options used by all ability action factories.
 */
export interface AbilityActionOptions<T = unknown> {
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `AbilityActionOptions` instead.
 */
export type AbilityActionConfig<T = unknown> = AbilityActionOptions<T>;

/**
 * Shared execute options used by all ability execute helpers.
 */
export interface ExecuteAbilityOptions<T = unknown> {
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteAbilityOptions` instead.
 */
export type ExecuteAbilityConfig<T = unknown> = ExecuteAbilityOptions<T>;

/**
 * Internal parameter object for creating one typed ability action.
 */
type CreateAbilityActionParams<
  TInput,
  TResponse,
  TSchema extends z.ZodType,
> = AbilityActionOptions<TResponse> & {
  client: ResolvableActionClient;
  schema?: TSchema;
  defaultSchema: TSchema;
  execute: (
    client: WordPressClient,
    input: TInput,
    options?: ExecuteAbilityOptions<TResponse>
  ) => Promise<TResponse>;
};

/**
 * Creates one reusable Astro action wrapper around one ability execute helper.
 */
export function createAbilityAction<
  TInput,
  TResponse,
  TSchema extends z.ZodType,
>(
  params: CreateAbilityActionParams<TInput, TResponse, TSchema>
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = params.schema ?? params.defaultSchema;
  const { responseSchema } = params;

  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const client = await resolveRequiredActionClient(params.client, context);

      // SAFETY: Each ability factory pairs its schema output with the corresponding executor input.
      return params.execute(client, input as TInput, { responseSchema });
    },
  }) as ActionClient<TResponse, undefined, TSchema> & string;
}
