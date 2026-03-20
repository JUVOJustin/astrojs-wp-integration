import { defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import {
  type WordPressPost,
  type WordPressStandardSchema,
} from 'fluent-wp-client/zod';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from './client';
import { getDefaultContentResponseSchema } from './response-schema';
import { createPostInputSchema } from './create';

/**
 * Full input schema for updating an existing WordPress post (or page / CPT).
 *
 * Extends `createPostInputSchema` (the shared writable fields used by both
 * create and update) with the required `id` field.
 *
 * Extend this schema to add custom fields such as ACF data:
 * @example
 * const mySchema = updatePostInputSchema.extend({
 *   acf: z.object({ hero_text: z.string().optional() }).optional(),
 * });
 */
export const updatePostInputSchema = createPostInputSchema.extend({
  id: z.number().int().positive(),
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

/**
 * Low-level options accepted by `executeUpdatePost`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'posts',
 * 'pages', 'books').  The optional `responseSchema` overrides the default
 * `postSchema` so the response can be parsed as a different type.
 */
export interface ExecuteUpdateOptions<T = WordPressPost> {
  /** REST resource path appended to the published client base URL (default: 'posts') */
  resource?: string;
  /** Standard Schema-compatible parser used for the response (default: postSchema) */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * @deprecated Use `ExecuteUpdateOptions` instead.
 */
export type ExecuteUpdateConfig<T = WordPressPost> = ExecuteUpdateOptions<T>;

/**
 * Shared non-auth options accepted by the update-post action factory.
 */
export interface UpdatePostActionOptions<T = WordPressPost> {
  /** REST resource path (default: 'posts') — set to 'pages' or a CPT rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: WordPressStandardSchema<T>;
}

/**
 * Shared non-auth options accepted by the update-post action factory.
 * At least one auth strategy is required because editing posts needs write access.
 */
export type UpdatePostActionConfig<T = WordPressPost> = UpdatePostActionOptions<T>;

type UpdatePostActionFactoryOptions<
  TResponse,
  TSchema extends typeof updatePostInputSchema,
> = UpdatePostActionOptions<TResponse> & { schema?: TSchema };

/**
 * Updates an existing WordPress post (or page / CPT) via the REST API.
 *
 * Set `options.resource` to target a different endpoint (e.g. `'pages'`,
 * `'books'`) and `options.responseSchema` to parse the response with a
 * matching Standard Schema-compatible validator.  Defaults to `'posts'` / `postSchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeUpdatePost<T = WordPressPost>(
  client: WordPressClient,
  input: UpdatePostInput & Record<string, unknown>,
  options?: ExecuteUpdateOptions<T>,
): Promise<T> {
  const resource = options?.resource ?? 'posts';

  return withActionClient(client, async (resolvedClient) => {
    const responseSchema = (options?.responseSchema ?? getDefaultContentResponseSchema(resource)) as WordPressStandardSchema<T>;
    const { id, ...fields } = input;

    return resolvedClient.updateContent<T, Record<string, unknown>>(
      resource,
      id,
      fields,
      responseSchema,
    );
  });
}

/**
 * Creates a predefined Astro server action that updates a WordPress post
 * (or page / CPT) via the REST API.  All provided fields are passed through
 * to WordPress, and any error returned by WordPress is surfaced as an
 * `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'pages'`).
 * Pass a custom `schema` (via `updatePostInputSchema.extend(...)`) to
 * include extra fields such as ACF data or other custom plugin fields.
 *
 * @example
 * const wp = new WordPressClient({ baseUrl: import.meta.env.WP_URL, auth: { token } });
 *
 * export const server = {
 *   updatePost: createUpdatePostAction(wp),
 *   updatePage: createUpdatePostAction(wp, { resource: 'pages' }),
 * };
 */
export function createUpdatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof updatePostInputSchema = typeof updatePostInputSchema
>(client: ResolvableActionClient, options?: UpdatePostActionFactoryOptions<TResponse, TSchema>): ActionClient<TResponse, undefined, TSchema> & string;
export function createUpdatePostAction<
  TResponse = WordPressPost,
  TSchema extends typeof updatePostInputSchema = typeof updatePostInputSchema
>(
  client: ResolvableActionClient,
  options?: UpdatePostActionFactoryOptions<TResponse, TSchema>,
): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (options?.schema ?? updatePostInputSchema) as TSchema;
  const resource = options?.resource;
  const responseSchema = options?.responseSchema;

  // TypeScript defers evaluation of ActionHandler<TSchema, …> when TSchema is a
  // generic parameter — `as any` is scoped to this call site only and does not
  // affect callers who still receive the full ActionClient<TResponse, undefined, TSchema> type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeUpdatePost<TResponse>(
        resolvedClient,
        input as UpdatePostInput & Record<string, unknown>,
        { resource, responseSchema },
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
