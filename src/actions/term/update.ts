import { defineAction, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  categorySchema,
  type WordPressCategory,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';
import { createTermInputSchema } from './create';

/**
 * Full input schema for updating an existing taxonomy term.
 */
export const updateTermInputSchema = createTermInputSchema.extend({
  id: z.number().int().positive(),
});

export type UpdateTermInput = z.infer<typeof updateTermInputSchema>;

/**
 * Low-level config accepted by `executeUpdateTerm`.
 */
export interface ExecuteUpdateTermConfig<T = WordPressCategory> extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: categorySchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the update-term action factory.
 */
export interface UpdateTermActionConfig<T = WordPressCategory> {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Updates one WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeUpdateTerm<T = WordPressCategory>(
  config: ExecuteUpdateTermConfig<T>,
  input: UpdateTermInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'categories';

  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? categorySchema) as WordPressStandardSchema<T>;
    const { id, ...fields } = input;

    return client.updateTerm<T, Record<string, unknown>>(
      resource,
      id,
      fields,
      responseSchema,
    );
  });
}

/**
 * Creates one Astro server action that updates taxonomy terms.
 */
export function createUpdateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof updateTermInputSchema = typeof updateTermInputSchema
>(config: UpdateTermActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? updateTermInputSchema) as TSchema;
  const resource = config.resource;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeUpdateTerm<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, resource, responseSchema },
        input as UpdateTermInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
