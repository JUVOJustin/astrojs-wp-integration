import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  authorSchema,
  type UserWriteInput,
  type WordPressAuthor,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';

/**
 * Input schema for creating a WordPress user.
 */
export const createUserInputSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  nickname: z.string().optional(),
  description: z.string().optional(),
  roles: z.array(z.string()).optional(),
  url: z.string().url().optional(),
}).passthrough();

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
export type ExecuteCreateUserConfig<T = WordPressAuthor> = ExecuteCreateUserOptions<T>;

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
export type CreateUserActionConfig<T = WordPressAuthor> = CreateUserActionOptions<T>;

type CreateUserActionFactoryOptions<
  TResponse,
  TSchema extends typeof createUserInputSchema,
> = CreateUserActionOptions<TResponse> & { schema?: TSchema };

/**
 * Creates a new WordPress user via the REST API.
 */
export async function executeCreateUser<T = WordPressAuthor>(
  client: WordPressClient,
  input: CreateUserInput & Record<string, unknown>,
  options?: ExecuteCreateUserOptions<T>,
): Promise<T> {
  return withActionClient(client, async (resolvedClient) => {
    const responseSchema = (options?.responseSchema ?? authorSchema) as WordPressStandardSchema<T>;
    return resolvedClient.createUser<T>(input as UserWriteInput, responseSchema);
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
  options?: CreateUserActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? createUserInputSchema) as TSchema;
  const responseSchema = options?.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeCreateUser<TResponse>(
        resolvedClient,
        input as CreateUserInput & Record<string, unknown>,
        { responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
