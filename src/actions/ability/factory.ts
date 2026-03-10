import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import type { WordPressStandardSchema } from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import type { ExecuteActionAuthConfig } from '../post/client';

/**
 * Shared action config used by all ability action factories.
 */
export interface AbilityActionConfig<T = unknown> {
  baseUrl: string;
  auth?: ActionAuthConfig;
  authHeaders?: ResolvableActionAuthHeaders;
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Shared execute config used by all ability execute helpers.
 */
export type ExecuteAbilityConfig<T = unknown> = ExecuteActionAuthConfig & {
  responseSchema?: WordPressStandardSchema<T>;
};

/**
 * Internal parameter object for creating one typed ability action.
 */
interface CreateAbilityActionParams<TInput, TResponse, TSchema extends z.ZodType> extends AbilityActionConfig<TResponse> {
  schema?: TSchema;
  defaultSchema: TSchema;
  execute: (
    config: ExecuteAbilityConfig<TResponse>,
    input: TInput,
  ) => Promise<TResponse>;
}

/**
 * Creates one reusable Astro action wrapper around one ability execute helper.
 */
export function createAbilityAction<
  TInput,
  TResponse,
  TSchema extends z.ZodType,
>(params: CreateAbilityActionParams<TInput, TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (params.schema ?? params.defaultSchema) as TSchema;
  const responseSchema = params.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: params.auth,
        authHeaders: params.authHeaders,
      }, context);

      return params.execute(
        {
          baseUrl: params.baseUrl,
          ...requestAuth,
          responseSchema,
        },
        input as TInput,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
