import type { ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  runAbilityInputSchema as clientRunAbilityInputSchema,
  type RunAbilityInput as ClientRunAbilityInput,
} from 'fluent-wp-client';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';
import { createAbilityAction, type AbilityActionConfig } from './factory';

/**
 * Input schema for executing one regular WordPress ability via POST.
 */
export const runAbilityInputSchema = clientRunAbilityInputSchema;

export type RunAbilityInput = ClientRunAbilityInput;

/**
 * Low-level config accepted by `executeRunAbility`.
 */
export interface ExecuteRunAbilityConfig<T = unknown> extends ExecuteActionAuthConfig {
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the run-ability action factory.
 */
export interface RunAbilityActionConfig<T = unknown> extends AbilityActionConfig<T> {}

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
>(config: RunAbilityActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  return createAbilityAction<RunAbilityInput, TResponse, TSchema>({
    ...config,
    defaultSchema: runAbilityInputSchema as TSchema,
    execute: (executeConfig, input) => executeRunAbility<TResponse>(executeConfig, input),
  });
}
