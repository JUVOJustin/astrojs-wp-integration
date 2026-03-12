import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import {
  authorSchema,
  type UserWriteInput,
  type WordPressAuthor,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { withActionClient, type ExecuteActionAuthConfig } from '../post/client';

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
 * Low-level config accepted by `executeUpdateUser`.
 */
export interface ExecuteUpdateUserConfig<T = WordPressAuthor> extends ExecuteActionAuthConfig {
  /** Standard Schema-compatible parser used for the response (default: authorSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the update-user action factory.
 */
export interface UpdateUserActionConfig<T = WordPressAuthor> {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Updates one existing WordPress user via the REST API.
 */
export async function executeUpdateUser<T = WordPressAuthor>(
  config: ExecuteUpdateUserConfig<T>,
  input: UpdateUserInput & Record<string, unknown>,
): Promise<T> {
  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? authorSchema) as WordPressStandardSchema<T>;
    const { id, ...fields } = input;

    return client.updateUser<T>(id, fields as UserWriteInput, responseSchema);
  });
}

/**
 * Creates a predefined Astro server action that updates a WordPress user.
 */
export function createUpdateUserAction<
  TResponse = WordPressAuthor,
  TSchema extends typeof updateUserInputSchema = typeof updateUserInputSchema,
>(config: UpdateUserActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? updateUserInputSchema) as TSchema;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeUpdateUser<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, responseSchema },
        input as UpdateUserInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
