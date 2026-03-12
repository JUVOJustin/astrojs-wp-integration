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
 * Low-level config accepted by `executeCreateUser`.
 */
export interface ExecuteCreateUserConfig<T = WordPressAuthor> extends ExecuteActionAuthConfig {
  /** Standard Schema-compatible parser used for the response (default: authorSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Configuration required to create the create-user action factory.
 */
export interface CreateUserActionConfig<T = WordPressAuthor> {
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
 * Creates a new WordPress user via the REST API.
 */
export async function executeCreateUser<T = WordPressAuthor>(
  config: ExecuteCreateUserConfig<T>,
  input: CreateUserInput & Record<string, unknown>,
): Promise<T> {
  return withActionClient(config, async (client) => {
    const responseSchema = (config.responseSchema ?? authorSchema) as WordPressStandardSchema<T>;

    return client.createUser<T>(input as UserWriteInput, responseSchema);
  });
}

/**
 * Creates a predefined Astro server action that creates a WordPress user.
 */
export function createCreateUserAction<
  TResponse = WordPressAuthor,
  TSchema extends typeof createUserInputSchema = typeof createUserInputSchema,
>(config: CreateUserActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createUserInputSchema) as TSchema;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeCreateUser<TResponse>(
        { baseUrl: config.baseUrl, ...requestAuth, responseSchema },
        input as CreateUserInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
