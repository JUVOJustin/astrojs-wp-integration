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
 * Input schema for creating a WordPress user.
 */
export const createUserInputSchema = z
  .object({
    description: z.string().optional(),
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    name: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().min(1),
    roles: z.array(z.string()).optional(),
    url: z.string().url().optional(),
    username: z.string().min(1),
  })
  .passthrough();

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

/**
 * Low-level options accepted by `executeCreateUser`.
 */
export interface ExecuteCreateUserOptions<T = WordPressAuthor> {
  /** Standard Schema-compatible parser used for the response (default: authorSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteCreateUserOptions` instead.
 */
export type ExecuteCreateUserConfig<T = WordPressAuthor> =
  ExecuteCreateUserOptions<T>;

/**
 * Shared non-auth options accepted by the create-user action factory.
 */
export interface CreateUserActionOptions<T = WordPressAuthor> {
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `CreateUserActionOptions` instead.
 */
export type CreateUserActionConfig<T = WordPressAuthor> =
  CreateUserActionOptions<T>;

type CreateUserActionFactoryOptions<
  TResponse,
  TSchema extends typeof createUserInputSchema,
> = CreateUserActionOptions<TResponse> & { schema?: TSchema };

/**
 * Creates a new WordPress user via the REST API.
 */
export async function executeCreateUser<T = WordPressAuthor>(
  client: WordPressClient,
  input: CreateUserInput,
  options?: ExecuteCreateUserOptions<T>
): Promise<T> {
  return withActionClient(client, async (resolvedClient) => {
    const created = await resolvedClient.users().create(input);

    // SAFETY: An explicitly chosen T requires a matching responseSchema; the fallback serves the default resource type.
    const responseSchema = (options?.responseSchema ??
      authorSchema) as WordPressStandardSchema<T>;

    return validateActionResponse(
      created,
      responseSchema,
      'WordPress user create action'
    );
  });
}

/**
 * Creates a predefined Astro server action that creates a WordPress user.
 */
export function createCreateUserAction<
  TResponse = WordPressAuthor,
  TSchema extends typeof createUserInputSchema = typeof createUserInputSchema,
>(
  client: ResolvableActionClient,
  options?: CreateUserActionFactoryOptions<TResponse, TSchema>
): ActionClient<TResponse, undefined, TSchema> & string {
  // SAFETY: A custom schema carries TSchema; otherwise the factory uses its default schema.
  const inputSchema = (options?.schema ?? createUserInputSchema) as TSchema;
  const responseSchema = options?.responseSchema;

  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeCreateUser<TResponse>(resolvedClient, input, {
        responseSchema,
      });
    },
  }) as ActionClient<TResponse, undefined, TSchema> & string;
}
