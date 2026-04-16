import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  postWriteBaseSchema,
  type WordPressPost,
  type WordPressStandardSchema,
  type WordPressPostWriteBase,
} from 'fluent-wp-client/zod';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from './client';
import { validateActionResponse } from '../response-validation';
import { getDefaultContentResponseSchema } from './response-schema';

/**
 * Input schema for creating a new WordPress post (or page / custom post type).
 *
 * Identical to `updatePostInputSchema` minus the `id` field — WordPress
 * assigns the ID on creation.  All fields are optional; WordPress applies
 * sensible defaults (e.g. status defaults to 'draft').
 *
 * Extend to add custom fields such as ACF data:
 * @example
 * const mySchema = createPostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 */
export const createPostInputSchema = postWriteBaseSchema;

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

/**
 * Low-level options accepted by `executeCreatePost`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'posts',
 * 'pages', 'books').  The optional `responseSchema` overrides the default
 * `postSchema` so the response can be parsed as a different type.
 */
export interface ExecuteCreateOptions<T = WordPressPost> {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: postSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteCreateOptions` instead.
 */
export type ExecuteCreateConfig<T = WordPressPost> = ExecuteCreateOptions<T>;

/**
 * Shared non-auth options accepted by the create-post action factory.
 */
export interface CreatePostActionOptions<T = WordPressPost> {
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `CreatePostActionOptions` instead.
 */
export type CreatePostActionConfig<T = WordPressPost> = CreatePostActionOptions<T>;

type CreatePostActionFactoryOptions<
  TResponse,
  TSchema extends typeof createPostInputSchema,
> = CreatePostActionOptions<TResponse> & { schema?: TSchema };

/**
 * Creates a new WordPress post (or page / CPT) via the REST API.
 *
 * Set `options.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `options.responseSchema` to parse the response with a
 * matching Standard Schema-compatible validator.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeCreatePost<T = WordPressPost>(
  client: WordPressClient,
  input: CreatePostInput & Record<string, unknown>,
  options?: ExecuteCreateOptions<T>,
): Promise<T> {
  const resource = options?.resource ?? 'posts';

  return withActionClient(client, async (resolvedClient) => {
    const created = await resolvedClient.content(resource).create(input as WordPressPostWriteBase);
    const responseSchema = (options?.responseSchema ?? getDefaultContentResponseSchema(resource)) as WordPressStandardSchema<T>;

    return validateActionResponse(created, responseSchema, `WordPress ${resource} create action`);
  });
}

/**
 * Creates a predefined Astro server action that creates a new WordPress post
 * (or page / CPT) via the REST API.  All provided fields are forwarded to
 * WordPress, and any error is surfaced as an `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'pages'`).
 * Pass a custom `schema` (via `createPostInputSchema.extend(...)`) for
 * typed custom fields such as ACF data.
 *
 * @example
 * const wp = new WordPressClient({ baseUrl: import.meta.env.WP_URL, auth: { token } });
 *
 * export const server = {
 *   createPost: createCreatePostAction(wp),
 *   createPage: createCreatePostAction(wp, { resource: 'pages' }),
 * };
 */
export function createCreatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof createPostInputSchema = typeof createPostInputSchema
>(client: ResolvableActionClient, options?: CreatePostActionFactoryOptions<TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string;
export function createCreatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof createPostInputSchema = typeof createPostInputSchema
>(
  client: ResolvableActionClient,
  options?: CreatePostActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? createPostInputSchema) as TSchema;
  const resource = options?.resource;
  const responseSchema = options?.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeCreatePost<TResponse>(
        resolvedClient,
        input as CreatePostInput & Record<string, unknown>,
        { resource, responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
