import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';
import type { ActionAPIContext, ActionClient } from 'astro:actions';
import type { WordPressClient } from 'fluent-wp-client';

import {
  createContentInvalidationTags,
  createTermInvalidationTags,
  createUserInvalidationTags,
} from '../../cache/hints';
import { resolveRequiredActionClient, withActionClient } from '../post/client';
import type { ResolvableActionClient } from '../post/client';
import {
  assertCacheEnabled,
  invalidateCacheBaseSchema,
  invalidateCacheTags,
  resolveContentResource,
  resolveTermResource,
} from './shared';
import type { CacheInvalidationResult } from './shared';

/**
 * Input schema for invalidating one cached WordPress entity.
 */
export const wpCacheInvalidateInputSchema = invalidateCacheBaseSchema
  .extend({
    entity: z.enum(['post', 'term', 'user']),
    scope: z.enum(['entry', 'resource']).default('entry'),
    post_type: z.string().min(1).optional(),
    taxonomy: z.string().min(1).optional(),
  })
  .passthrough()
  .superRefine((input, context) => {
    if (input.entity === 'post' && !input.post_type) {
      context.addIssue({
        code: 'custom',
        message: '`post_type` is required when `entity` is `post`.',
        path: ['post_type'],
      });
    }

    if (input.entity === 'term' && !input.taxonomy) {
      context.addIssue({
        code: 'custom',
        message: '`taxonomy` is required when `entity` is `term`.',
        path: ['taxonomy'],
      });
    }

    if (input.entity !== 'post' && input.post_type) {
      context.addIssue({
        code: 'custom',
        message: '`post_type` is only valid when `entity` is `post`.',
        path: ['post_type'],
      });
    }

    if (input.entity !== 'term' && input.taxonomy) {
      context.addIssue({
        code: 'custom',
        message: '`taxonomy` is only valid when `entity` is `term`.',
        path: ['taxonomy'],
      });
    }
  });

export type WpCacheInvalidateInput = z.infer<
  typeof wpCacheInvalidateInputSchema
>;

/**
 * Invalidates the cache tags for one WordPress post, term, or user entity.
 */
export async function executeWpCacheInvalidate(
  client: WordPressClient,
  input: WpCacheInvalidateInput,
  context: ActionAPIContext
): Promise<CacheInvalidationResult> {
  assertCacheEnabled(context);

  if (input.entity === 'post') {
    // SAFETY: superRefine requires post_type for post inputs before Astro invokes this action.
    const postType = input.post_type as string;
    const resource = await resolveContentResource(client, postType);

    if (input.scope === 'resource') {
      return invalidateCacheTags(context, resource, [
        `wp:resource:${resource}`,
      ]);
    }

    return withActionClient(client, async (resolvedClient) => {
      const entry = await resolvedClient.content(resource).item(input.id);

      if (!entry) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `WordPress ${resource} '${input.id}' was not found.`,
        });
      }

      const tags = createContentInvalidationTags(resource, entry.id);

      return invalidateCacheTags(context, resource, tags);
    });
  }

  if (input.entity === 'term') {
    // SAFETY: superRefine requires taxonomy for term inputs before Astro invokes this action.
    const taxonomy = input.taxonomy as string;
    const resource = await resolveTermResource(client, taxonomy);

    if (input.scope === 'resource') {
      return invalidateCacheTags(context, resource, [
        `wp:resource:${resource}`,
      ]);
    }

    return withActionClient(client, async (resolvedClient) => {
      const entry = await resolvedClient.terms(resource).item(input.id);

      if (!entry) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `WordPress ${resource} '${input.id}' was not found.`,
        });
      }

      const tags = createTermInvalidationTags(resource, entry);

      return invalidateCacheTags(context, resource, tags);
    });
  }

  if (input.scope === 'resource') {
    return invalidateCacheTags(context, 'users', ['wp:resource:users']);
  }

  return withActionClient(client, async (resolvedClient) => {
    const entry = await resolvedClient.users().item(input.id);

    if (!entry) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: `WordPress user '${input.id}' was not found.`,
      });
    }

    const tags = createUserInvalidationTags(entry.id);

    return invalidateCacheTags(context, 'users', tags);
  });
}

/**
 * Creates one Astro action that invalidates the cache for a single WordPress entity.
 */
export function createWpCacheInvalidateAction(
  client: ResolvableActionClient
): ActionClient<
  CacheInvalidationResult,
  undefined,
  typeof wpCacheInvalidateInputSchema
> &
  string {
  // SAFETY: Astro's generated action proxy supplies the callable and string-coercion API.
  return defineAction({
    input: wpCacheInvalidateInputSchema,
    handler: async (
      input: WpCacheInvalidateInput,
      context: ActionAPIContext
    ) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);

      return executeWpCacheInvalidate(resolvedClient, input, context);
    },
  }) as ActionClient<
    CacheInvalidationResult,
    undefined,
    typeof wpCacheInvalidateInputSchema
  > &
    string;
}
