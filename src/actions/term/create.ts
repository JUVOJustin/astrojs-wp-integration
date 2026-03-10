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

/**
 * Shared writable fields for creating taxonomy terms.
 */
export const createTermInputSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  parent: z.number().int().nonnegative().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type CreateTermInput = z.infer<typeof createTermInputSchema>;

/**
 * Low-level config accepted by `executeCreateTerm`.
 */
export interface ExecuteCreateTermConfig<T = WordPressCategory> extends ExecuteActionAuthConfig {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: categorySchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the create-term action factory.
 */
export interface CreateTermActionConfig<T = WordPressCategory> {
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
 * Creates a new WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeCreateTerm<T = WordPressCategory>(
  config: ExecuteCreateTermConfig<T>,
  input: CreateTermInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'categories';

  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? categorySchema) as WordPressStandardSchema<T>;

    return client.createTerm<T, CreateTermInput & Record<string, unknown>>(
      resource,
      input,
      responseSchema,
    );
  });
}

/**
 * Creates one Astro server action that creates taxonomy terms.
 */
export function createCreateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof createTermInputSchema = typeof createTermInputSchema
>(config: CreateTermActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createTermInputSchema) as TSchema;
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

      return executeCreateTerm<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, resource, responseSchema },
        input as CreateTermInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
