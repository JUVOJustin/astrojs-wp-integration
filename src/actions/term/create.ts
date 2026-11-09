import { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import { categorySchema } from 'fluent-wp-client';
import type {
  WordPressClient,
  WordPressCategory,
  WordPressStandardSchema,
} from 'fluent-wp-client';

import { resolveRequiredActionClient, withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';
import { validateActionResponse } from '../response-validation';

/**
 * Shared writable fields for creating taxonomy terms.
 */
export const createTermInputSchema = z
  .object({
    description: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    name: z.string().optional(),
    parent: z.number().int().nonnegative().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

export type CreateTermInput = z.infer<typeof createTermInputSchema>;

/**
 * Low-level options accepted by `executeCreateTerm`.
 */
export interface ExecuteCreateTermOptions<T = WordPressCategory> {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: categorySchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteCreateTermOptions` instead.
 */
export type ExecuteCreateTermConfig<T = WordPressCategory> =
  ExecuteCreateTermOptions<T>;

/**
 * Shared non-auth options accepted by the create-term action factory.
 */
export interface CreateTermActionOptions<T = WordPressCategory> {
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `CreateTermActionOptions` instead.
 */
export type CreateTermActionConfig<T = WordPressCategory> =
  CreateTermActionOptions<T>;

type CreateTermActionFactoryOptions<
  TResponse,
  TSchema extends typeof createTermInputSchema,
> = CreateTermActionOptions<TResponse> & { schema?: TSchema };

/**
 * Creates a new WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeCreateTerm<T = WordPressCategory>(
  client: WordPressClient,
  input: CreateTermInput,
  options?: ExecuteCreateTermOptions<T>
): Promise<T> {
  const resource = options?.resource ?? 'categories';

  return withActionClient(client, async (resolvedClient) => {
    const created = await resolvedClient.terms(resource).create(input);

    // SAFETY: An explicitly chosen T requires a matching responseSchema; the fallback serves the default resource type.
    const responseSchema = (options?.responseSchema ??
      categorySchema) as WordPressStandardSchema<T>;

    return validateActionResponse(
      created,
      responseSchema,
      `WordPress ${resource} create action`
    );
  });
}

/**
 * Creates one Astro server action that creates taxonomy terms.
 */
export function createCreateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof createTermInputSchema = typeof createTermInputSchema,
>(
  client: ResolvableActionClient,
  options?: CreateTermActionFactoryOptions<TResponse, TSchema>
): ActionClient<TResponse, undefined, TSchema> & string {
  // SAFETY: A custom schema carries TSchema; otherwise the factory uses its default schema.
  const inputSchema = (options?.schema ?? createTermInputSchema) as TSchema;
  const resource = options?.resource;
  const responseSchema = options?.responseSchema;

  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeCreateTerm<TResponse>(resolvedClient, input, {
        resource,
        responseSchema,
      });
    },
  }) as ActionClient<TResponse, undefined, TSchema> & string;
}
