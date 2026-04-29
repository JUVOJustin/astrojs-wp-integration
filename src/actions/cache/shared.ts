import { ActionError, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressClient } from 'fluent-wp-client';
import { withActionClient } from '../post/client';

/**
 * Shared input fields for cache invalidation actions.
 */
export const invalidateCacheBaseSchema = z.object({
  id: z.number().int().positive(),
}).passthrough();

/**
 * Shared success payload returned by cache invalidation actions.
 */
export interface CacheInvalidationResult {
  invalidated: true;
  resource: string;
  tags: string[];
}

type RestResourceDefinition = {
  rest_base?: string;
};

/**
 * Ensures the current action request can talk to Astro's route cache provider.
 */
export function assertCacheEnabled(context: ActionAPIContext): void {
  if (context.cache.enabled) {
    return;
  }

  throw new ActionError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Route caching is not enabled for this Astro app.',
  });
}

/**
 * Resolves one WordPress post type to the REST resource slug used by the client.
 */
export async function resolveContentResource(client: WordPressClient, postType: string): Promise<string> {
  return withActionClient(client, async (resolvedClient) => {
    const response = await resolvedClient.request<RestResourceDefinition>({
      endpoint: `/wp-json/wp/v2/types/${postType}`,
    });

    const resource = response.data.rest_base;

    if (typeof resource === 'string' && resource.length > 0) {
      return resource;
    }

    throw new ActionError({
      code: 'NOT_FOUND',
      message: `WordPress post type '${postType}' does not expose a REST resource.`,
    });
  });
}

/**
 * Resolves one WordPress taxonomy slug to the REST resource slug used by the client.
 */
export async function resolveTermResource(client: WordPressClient, taxonomy: string): Promise<string> {
  return withActionClient(client, async (resolvedClient) => {
    const response = await resolvedClient.request<RestResourceDefinition>({
      endpoint: `/wp-json/wp/v2/taxonomies/${taxonomy}`,
    });

    const resource = response.data.rest_base;

    if (typeof resource === 'string' && resource.length > 0) {
      return resource;
    }

    throw new ActionError({
      code: 'NOT_FOUND',
      message: `WordPress taxonomy '${taxonomy}' does not expose a REST resource.`,
    });
  });
}

/**
 * Invalidates one set of Astro cache tags and returns the action response payload.
 */
export async function invalidateCacheTags(
  context: ActionAPIContext,
  resource: string,
  tags: string[],
): Promise<CacheInvalidationResult> {
  if (tags.length === 0) {
    throw new ActionError({
      code: 'BAD_REQUEST',
      message: 'No cache tags were derived for this WordPress resource.',
    });
  }

  await context.cache.invalidate({ tags });

  return {
    invalidated: true,
    resource,
    tags,
  };
}
