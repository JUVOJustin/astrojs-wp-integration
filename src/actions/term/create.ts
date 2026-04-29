import {
  type ActionAPIContext,
  type ActionClient,
  defineAction,
} from 'astro:actions';
import { z } from 'astro/zod';
import type { TermWriteInput, WordPressClient } from 'fluent-wp-client';
import {
  categorySchema,
  type WordPressCategory,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  type ResolvableActionClient,
  resolveRequiredActionClient,
  withActionClient,
} from '../post/client';
import { validateActionResponse } from '../response-validation';

/**
 * Shared writable fields for creating taxonomy terms.
 */
export const createTermInputSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    parent: z.number().int().nonnegative().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
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
  input: CreateTermInput & Record<string, unknown>,
  options?: ExecuteCreateTermOptions<T>,
): Promise<T> {
  const resource = options?.resource ?? 'categories';

  return withActionClient(client, async (resolvedClient) => {
    const created = await resolvedClient
      .terms(resource)
      .create(input as TermWriteInput);
    const responseSchema = (options?.responseSchema ??
      categorySchema) as WordPressStandardSchema<T>;

    return validateActionResponse(
      created,
      responseSchema,
      `WordPress ${resource} create action`,
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
  options?: CreateTermActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? createTermInputSchema) as TSchema;
  const resource = options?.resource;
  const responseSchema = options?.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeCreateTerm<TResponse>(
        resolvedClient,
        input as CreateTermInput & Record<string, unknown>,
        { resource, responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
