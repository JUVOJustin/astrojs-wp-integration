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
 * Full input schema for updating an existing WordPress taxonomy term.
 *
 * Extends `termWriteBaseSchema` (the shared writable fields used by both
 * create and update) with the required `id` field.
 *
 * Extend this schema to add custom fields such as ACF data:
 * @example
 * const mySchema = updateTermInputSchema.extend({
 *   acf: z.object({ color: z.string().optional() }).optional(),
 * });
 */
export const updateTermInputSchema = termWriteBaseSchema.extend({
  /** ID of the term to update (required) */
  id: z.number().int().positive(),
});

export type UpdateTermInput = z.infer<typeof updateTermInputSchema>;

/**
 * Low-level config accepted by `executeUpdateTerm`.
 * The `resource` controls which REST endpoint is targeted (e.g. 'categories',
 * 'tags', or a custom taxonomy rest_base).  The optional `responseSchema`
 * overrides the default `categorySchema` so the response can be parsed as
 * a different type.
 */
export interface ExecuteUpdateTermConfig<T = WordPressCategory> extends ExecuteActionAuthConfig {
  /** REST resource path appended to `apiBase` (default: 'categories') */
  resource?: string;
  /** Zod schema used to parse the response (default: categorySchema) */
  responseSchema?: z.ZodType<T>;
}

/**
 * Configuration required to create the update-term action factory.
 * At least one auth strategy is required because editing terms needs write access.
 */
export interface UpdateTermActionConfig<T = WordPressCategory> {
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
 * Updates an existing WordPress taxonomy term via the REST API.
 *
 * Set `config.resource` to target a different endpoint (e.g. `'tags'`,
 * `'genres'`) and `config.responseSchema` to parse the response with a
 * matching Zod schema.  Defaults to `'categories'` / `categorySchema`.
 *
 * Exported for direct use in integration tests without the Astro runtime.
 * Throws `ActionError` on API failure.
 */
export async function executeUpdateTerm<T = WordPressCategory>(
  config: ExecuteUpdateTermConfig<T>,
  input: UpdateTermInput & Record<string, unknown>
): Promise<T> {
  const resource = config.resource ?? 'categories';
  const { id, ...fields } = input;

  // Only include fields that were explicitly provided; custom fields pass through as-is
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  // WordPress REST API uses POST (not PUT/PATCH) for updating existing terms
  const { data, response } = await executeActionRequest<unknown>(config, {
    method: 'POST',
    endpoint: `/${resource}/${id}`,
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
 * Creates a predefined Astro server action that updates a WordPress taxonomy
 * term via the REST API.  All provided fields are passed through to WordPress,
 * and any error returned by WordPress is surfaced as an `ActionError`.
 *
 * Set `resource` to target a different REST endpoint (e.g. `'tags'`).
 * Pass a custom `schema` (via `updateTermInputSchema.extend(...)`) to
 * include extra fields such as ACF data or other custom plugin fields.
 *
 * @example
 * // Basic usage (categories)
 * export const server = {
 *   updateCategory: createUpdateTermAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *   }),
 * };
 *
 * @example
 * // Tags
 * export const server = {
 *   updateTag: createUpdateTermAction({
 *     baseUrl: import.meta.env.WP_URL,
 *     auth: { username: import.meta.env.WP_USERNAME, password: import.meta.env.WP_APP_PASSWORD },
 *     resource: 'tags',
 *   }),
 * };
 */
export function createUpdateTermAction<
  TResponse = WordPressCategory,
  TSchema extends typeof updateTermInputSchema = typeof updateTermInputSchema
>(config: UpdateTermActionConfig<TResponse> & { schema?: TSchema }): ActionClient<TResponse, undefined, TSchema> & string {
  const inputSchema = (config.schema ?? updateTermInputSchema) as TSchema;
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

      return executeUpdateTerm<TResponse>(
        { apiBase, ...requestAuth, resource, responseSchema },
        input as UpdateTermInput & Record<string, unknown>,
      );
    },
  } as any) as ActionClient<TResponse, undefined, TSchema> & string;
}
