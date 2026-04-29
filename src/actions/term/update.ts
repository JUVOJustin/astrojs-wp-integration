import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  categorySchema,
  type WordPressCategory,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';
import { validateActionResponse } from '../response-validation';
import { createTermInputSchema } from './create';

/**
 * Full input schema for updating an existing taxonomy term.
 */
export const updateTermInputSchema = createTermInputSchema.extend({
  id: z.number().int().positive(),
});

export type UpdateTermInput = z.infer<typeof updateTermInputSchema>;

/**
 * Low-level options accepted by `executeUpdateTerm`.
 */
export interface ExecuteUpdateTermOptions<T = WordPressCategory> {
  /** REST resource path appended to the published client base URL (default: 'categories') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: categorySchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteUpdateTermOptions` instead.
 */
export type ExecuteUpdateTermConfig<T = WordPressCategory> = ExecuteUpdateTermOptions<T>;

/**
 * Shared non-auth options accepted by the update-term action factory.
 */
export interface UpdateTermActionOptions<T = WordPressCategory> {
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `UpdateTermActionOptions` instead.
 */
export type UpdateTermActionConfig<T = WordPressCategory> = UpdateTermActionOptions<T>;

type UpdateTermActionFactoryOptions<
  TResponse,
  TSchema extends typeof updateTermInputSchema,
> = UpdateTermActionOptions<TResponse> & { schema?: TSchema };

/**
 * Updates one WordPress term (category, tag, or custom taxonomy term).
 */
export async function executeUpdateTerm<T = WordPressCategory>(
  client: WordPressClient,
  input: UpdateTermInput & Record<string, unknown>,
  options?: ExecuteUpdateTermOptions<T>,
): Promise<T> {
  const resource = options?.resource ?? 'categories';

  return withActionClient(client, async (resolvedClient) => {
    const { id, ...fields } = input;
    const updated = await resolvedClient.terms(resource).update(id, fields);
    const responseSchema = (options?.responseSchema ?? categorySchema) as WordPressStandardSchema<T>;

    return validateActionResponse(updated, responseSchema, `WordPress ${resource} update action`);
  });
}

/**
 * Creates one Astro server action that updates taxonomy terms.
 */
export function createUpdateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof updateTermInputSchema = typeof updateTermInputSchema,
>(
  client: ResolvableActionClient,
  options?: UpdateTermActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? updateTermInputSchema) as TSchema;
  const resource = options?.resource;
  const responseSchema = options?.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeUpdateTerm<TResponse>(
        resolvedClient,
        input as UpdateTermInput & Record<string, unknown>,
        { resource, responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
