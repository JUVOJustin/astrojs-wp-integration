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
import { validateActionResponse } from '../response-validation';

/**
 * Input schema for updating a WordPress user.
 */
export const updateUserInputSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  nickname: z.string().optional(),
  description: z.string().optional(),
  roles: z.array(z.string()).optional(),
  url: z.string().url().optional(),
}).passthrough();

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
export type ExecuteUpdateUserConfig<T = WordPressAuthor> = ExecuteUpdateUserOptions<T>;

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
export type UpdateUserActionConfig<T = WordPressAuthor> = UpdateUserActionOptions<T>;

type UpdateUserActionFactoryOptions<
  TResponse,
  TSchema extends typeof updateUserInputSchema,
> = UpdateUserActionOptions<TResponse> & { schema?: TSchema };

/**
 * Updates one existing WordPress user via the REST API.
 */
export async function executeUpdateUser<T = WordPressAuthor>(
  client: WordPressClient,
  input: UpdateUserInput & Record<string, unknown>,
  options?: ExecuteUpdateUserOptions<T>,
): Promise<T> {
  return withActionClient(client, async (resolvedClient) => {
    const { id, ...fields } = input;
    const updated = await resolvedClient.users().update(id, fields as UserWriteInput);
    const responseSchema = (options?.responseSchema ?? authorSchema) as WordPressStandardSchema<T>;

    return validateActionResponse(updated, responseSchema, 'WordPress user update action');
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
  options?: UpdateUserActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? updateUserInputSchema) as TSchema;
  const responseSchema = options?.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeUpdateUser<TResponse>(
        resolvedClient,
        input as UpdateUserInput & Record<string, unknown>,
        { responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
