import { defineAction, ActionError, type ActionAPIContext, type ActionClient } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { termWriteBaseSchema, categorySchema, wordPressErrorSchema } from '../../schemas';
import type { WordPressCategory } from '../../schemas';
import {
  resolveActionRequestAuth,
  type ActionAuthConfig,
  type ResolvableActionAuthHeaders,
} from '../auth';
import { executeActionRequest, type ExecuteActionAuthConfig } from '../post/client';

/**
 * Input schema for creating a new WordPress taxonomy term.
 *
 * All fields are optional; WordPress applies sensible defaults
 * (e.g. auto-generates slug from name).  The `name` field is required
 * by WordPress on the server side — omitting it will return a REST error.
 *
 * Extend to add custom fields such as ACF data:
 * @example
 * const mySchema = createTermInputSchema.extend({
 *   acf: z.object({ color: z.string().optional() }).optional(),
 * });
 */
export const createTermInputSchema = termWriteBaseSchema;

export type CreateTermInput = z.infer<typeof createTermInputSchema>;

/**
 * Low-level config accepted by `executeCreateTerm`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'categories',
 * 'tags', or a custom taxonomy rest_base).  The optional `responseSchema`
 * overrides the default `categorySchema` so the response can be parsed as
 * a different type.
 */
export interface ExecuteCreateTermConfig<T = WordPressCategory> extends ExecuteActionAuthConfig {
  /** REST resource path appended to `apiBase` (default: 'categories') */
  resource?: string;
  /** Zod schema used to parse the response (default: categorySchema) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the create-term action factory.
 * At least one auth strategy is required because creating terms needs write access.
 */
export interface CreateTermActionConfig<T = WordPressCategory> {
  /** WordPress site URL (e.g. 'https://example.com') */
  baseUrl: string;
  /** Static or request-scoped auth config (basic, JWT, or prebuilt header) */
  auth?: ActionAuthConfig;
  /** Advanced request-aware auth headers for OAuth-like signature methods */
  authHeaders?: ResolvableActionAuthHeaders;
  /** REST resource path (default: 'categories') — set to 'tags' or a custom taxonomy rest_base */
  resource?: string;
  /** Optional parser override for the action response */
  responseSchema?: z.ZodType<T>;
}

/**
 * Creates a new WordPress taxonomy term via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'tags'`,
 * `'genres'`) and `config.responseSchema` to parse the response with a
 * matching Zod schema.  Defaults to `'categories'` / `categorySchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeCreateTerm<T = WordPressCategory>(
  config: ExecuteCreateTermConfig<T>,
  input: CreateTermInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'categories';

  // Only include fields that were explicitly provided
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'POST',
    endpoint: `/${resource}`,
    body,
  });

  if (!response.ok) {
    const wpError = wordPressErrorSchema.safeParse(data);
    const message = wpError.success
      ? wpError.data.message
      : `WordPress API error: ${response.status} ${response.statusText}`;
    throw new ActionError({ code: ActionError.statusToCode(response.status), message });
  }

  const responseSchema = (config.responseSchema ?? categorySchema) as z.ZodType<T>;
  return responseSchema.parse(data);
}

/**
 * Creates a predefined Astro server action that creates a new WordPress
 * taxonomy term via the REST API.  All provided fields are forwarded to
 * WordPress, and any error is surfaced as an `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'tags'`).
 * Pass a custom `schema` (via `createTermInputSchema.extend(...)`) for
 * typed custom fields such as ACF data.
 *
 * @example
 * // Basic usage (categories)
 * export const server = {
 *   createCategory: createCreateTermAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // Tags
 * export const server = {
 *   createTag: createCreateTermAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *     resource: 'tags',
 *   }),
 * };
 */
export function createCreateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof createTermInputSchema = typeof createTermInputSchema
>(config: CreateTermActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? createTermInputSchema) as TSchema;
  const apiBase = `${config.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  const resource = config.resource;
  const responseSchema = config.responseSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineAction({
    input: inputSchema,
    handler: async (input: z.infer<TSchema>, context: ActionAPIContext) => {
      const requestAuth = await resolveActionRequestAuth({
        auth: config.auth,
        authHeaders: config.authHeaders,
      }, context);

      return executeCreateTerm<TResponse>(
        { apiBase, ...requestAuth, resource, responseSchema },
        input as CreateTermInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
