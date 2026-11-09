import { z } from 'astro/zod';
import { defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import { authorSchema } from 'fluent-wp-client';
import type {
  WordPressClient,
  WordPressAuthor,
  WordPressStandardSchema,
} from 'fluent-wp-client';

import { resolveRequiredActionClient, withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';
import { validateActionResponse } from '../response-validation';

/**
 * Input schema for updating a WordPress user.
 */
export const updateUserInputSchema = z
  .object({
    description: z.string().optional(),
    email: z.string().email().optional(),
    first_name: z.string().optional(),
    id: z.number().int().positive(),
    last_name: z.string().optional(),
    name: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().min(1).optional(),
    roles: z.array(z.string()).optional(),
    url: z.string().url().optional(),
    username: z.string().min(1).optional(),
  })
  .passthrough();

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

/**
 * Low-level options accepted by `executeUpdateUser`.
 */
export interface ExecuteUpdateUserOptions<T = WordPressAuthor> {
  /** Standard Schema-compatible parser used for the response (default: authorSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteUpdateUserOptions` instead.
 */
export type ExecuteUpdateUserConfig<T = WordPressAuthor> =
  ExecuteUpdateUserOptions<T>;

/**
 * Shared non-auth options accepted by the update-user action factory.
 */
export interface UpdateUserActionOptions<T = WordPressAuthor> {
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `UpdateUserActionOptions` instead.
 */
export type UpdateUserActionConfig<T = WordPressAuthor> =
  UpdateUserActionOptions<T>;

type UpdateUserActionFactoryOptions<
  TResponse,
  TSchema extends typeof updateUserInputSchema,
> = UpdateUserActionOptions<TResponse> & { schema?: TSchema };

/**
 * Updates one existing WordPress user via the REST API.
 */
export async function executeUpdateUser<T = WordPressAuthor>(
  client: WordPressClient,
  input: UpdateUserInput,
  options?: ExecuteUpdateUserOptions<T>
): Promise<T> {
  return withActionClient(client, async (resolvedClient) => {
    const { id, ...fields } = input;

    const updated = await resolvedClient.users().update(id, fields);

    // SAFETY: An explicitly chosen T requires a matching responseSchema; the fallback serves the default resource type.
    const responseSchema = (options?.responseSchema ??
      authorSchema) as WordPressStandardSchema<T>;

    return validateActionResponse(
      updated,
      responseSchema,
      'WordPress user update action'
    );
  });
}

/**
 * Creates a predefined Astro server action that updates a WordPress user.
 */
export function createUpdateUserAction<
  TResponse = WordPressAuthor,
  TSchema extends typeof updateUserInputSchema = typeof updateUserInputSchema,
>(
  client: ResolvableActionClient,
  options?: UpdateUserActionFactoryOptions<TResponse, TSchema>
): ActionClient<TResponse, undefined, TSchema> & string {
  // SAFETY: A custom schema carries TSchema; otherwise the factory uses its default schema.
  const inputSchema = (options?.schema ?? updateUserInputSchema) as TSchema;
  const responseSchema = options?.responseSchema;

  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeUpdateUser<TResponse>(resolvedClient, input, {
        responseSchema,
      });
    },
  }) as ActionClient<TResponse, undefined, TSchema> & string;
}
